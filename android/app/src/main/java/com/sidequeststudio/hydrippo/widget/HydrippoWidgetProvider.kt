package com.sidequeststudio.hydrippo.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.widget.RemoteViews
import com.sidequeststudio.hydrippo.MainActivity
import com.sidequeststudio.hydrippo.R
import kotlin.math.min

/**
 * Home-screen widget: today's total, a progress bar, Drip, and a one-tap "+ 8 oz" button.
 * Two layouts: a compact one for 2x2 and a wide one (with a bigger Drip) from about 3x2 up.
 */
class HydrippoWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) render(context, appWidgetManager, id)
        scheduleDayRollover(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        render(context, appWidgetManager, appWidgetId)
    }

    override fun onDisabled(context: Context) {
        context.getSystemService(AlarmManager::class.java)?.cancel(refreshIntent(context))
    }

    companion object {
        const val ACTION_ADD = "com.sidequeststudio.hydrippo.widget.ADD"
        const val ACTION_REFRESH = "com.sidequeststudio.hydrippo.widget.REFRESH"
        private const val WIDE_MIN_DP = 200

        /** Redraws every Hydrippo widget on the home screen. */
        fun refreshAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, HydrippoWidgetProvider::class.java))
            if (ids.isEmpty()) return
            for (id in ids) render(context, mgr, id)
            scheduleDayRollover(context)
        }

        private fun render(context: Context, mgr: AppWidgetManager, widgetId: Int) {
            val today = WidgetStore.today(context)
            val views: RemoteViews = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+: the launcher picks the layout that fits as the widget is resized.
                RemoteViews(
                    mapOf(
                        SizeF(100f, 100f) to build(context, R.layout.widget_small, today),
                        SizeF(WIDE_MIN_DP.toFloat(), 100f) to build(context, R.layout.widget_wide, today),
                    ),
                )
            } else {
                val minWidth = mgr.getAppWidgetOptions(widgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
                build(context, if (minWidth >= WIDE_MIN_DP) R.layout.widget_wide else R.layout.widget_small, today)
            }
            mgr.updateAppWidget(widgetId, views)
        }

        private fun build(context: Context, layout: Int, today: WidgetStore.Today?): RemoteViews {
            val rv = RemoteViews(context.packageName, layout)
            val open = openAppIntent(context)
            rv.setOnClickPendingIntent(android.R.id.background, open)

            if (today == null) {
                // The app hasn't been set up yet: send them there.
                rv.setTextViewText(R.id.w_total, context.getString(R.string.app_name))
                rv.setTextViewText(R.id.w_goal, context.getString(R.string.widget_setup))
                rv.setProgressBar(R.id.w_progress, 1000, 0, false)
                rv.setImageViewResource(R.id.w_drip, R.drawable.drip_thirsty)
                rv.setTextViewText(R.id.w_add, context.getString(R.string.widget_open))
                rv.setContentDescription(R.id.w_add, context.getString(R.string.widget_open))
                rv.setOnClickPendingIntent(R.id.w_add, open)
                return rv
            }

            val total = WidgetStore.format(today.totalMl, today.units)
            val goal = WidgetStore.format(today.goalMl, today.units)
            val add = WidgetStore.format(today.addMl, today.units)
            rv.setTextViewText(R.id.w_total, total)
            rv.setTextViewText(
                R.id.w_goal,
                if (today.reached) context.getString(R.string.widget_reached) else context.getString(R.string.widget_of_goal, goal),
            )
            rv.setProgressBar(R.id.w_progress, 1000, (min(1.0, today.fraction) * 1000).toInt(), false)
            rv.setImageViewResource(R.id.w_drip, moodDrawable(today))
            rv.setContentDescription(R.id.w_drip, context.getString(R.string.widget_status_desc, total, goal))
            rv.setTextViewText(R.id.w_add, context.getString(R.string.widget_add, add))
            rv.setContentDescription(R.id.w_add, context.getString(R.string.widget_add_desc, add))
            rv.setOnClickPendingIntent(R.id.w_add, actionIntent(context, ACTION_ADD, 1))
            return rv
        }

        // Same moods as Drip in the app (art.js): thirsty < 25% <= ok < 75% <= happy < goal <= splash.
        private fun moodDrawable(today: WidgetStore.Today): Int {
            val f = today.fraction
            return when {
                today.reached -> R.drawable.drip_splash
                f >= 0.75 -> R.drawable.drip_happy
                f >= 0.25 -> R.drawable.drip_ok
                else -> R.drawable.drip_thirsty
            }
        }

        private fun openAppIntent(context: Context): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .setAction(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        private fun actionIntent(context: Context, action: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, WidgetActionReceiver::class.java).setAction(action)
            return PendingIntent.getBroadcast(
                context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        private fun refreshIntent(context: Context): PendingIntent = actionIntent(context, ACTION_REFRESH, 2)

        /**
         * Wakes the widget just after the day ends so it starts the new day at zero.
         * Inexact and non-waking on purpose: it runs the next time the phone is awake, which is
         * the next time anyone could look at the home screen.
         */
        private fun scheduleDayRollover(context: Context) {
            val today = WidgetStore.today(context) ?: return
            val alarms = context.getSystemService(AlarmManager::class.java) ?: return
            alarms.set(AlarmManager.RTC, today.dayEnd + 5_000L, refreshIntent(context))
        }
    }
}
