package com.sidequeststudio.hydrippo.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles the widget's "+" button and the day-rollover refresh. Not exported. */
class WidgetActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            HydrippoWidgetProvider.ACTION_ADD -> {
                val summary = WidgetStore.summary(context) ?: return
                WidgetStore.addPending(context, System.currentTimeMillis(), summary.addMl)
                HydrippoWidgetProvider.refreshAll(context)
            }
            HydrippoWidgetProvider.ACTION_REFRESH -> HydrippoWidgetProvider.refreshAll(context)
        }
    }
}
