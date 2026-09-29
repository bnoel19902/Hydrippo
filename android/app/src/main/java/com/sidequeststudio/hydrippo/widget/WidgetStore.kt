package com.sidequeststudio.hydrippo.widget

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Shared state between the app and the home-screen widget.
 *
 * The app writes a small summary of today (total, goal, day boundaries, units) every time
 * something changes. Taps on the widget's "+" button are kept here as pending drinks until the
 * app next opens and moves them into its own log (see takePending / app.js mergeWidgetLogs).
 *
 * The day math mirrors www/js/core.js (dayKey / dayRange): a day runs from the day-end time
 * (for example 3:00 AM) to the same time the next day, in local time.
 */
object WidgetStore {
    private const val PREFS = "hydrippo_widget"
    private const val K_SUMMARY = "summary"
    private const val K_PENDING = "pending"
    private const val MAX_PENDING = 500

    const val ML_PER_OZ = 29.5735
    const val GOAL_TOLERANCE_ML = 15.0

    private val lock = Any()

    data class Summary(
        val totalMl: Double,
        val goalMl: Double,
        val baseGoalMl: Double,
        val units: String,
        val dayEndMin: Int,
        val dayStart: Long,
        val dayEnd: Long,
        val addMl: Double,
    )

    /** What the widget shows right now. */
    data class Today(
        val totalMl: Double,
        val goalMl: Double,
        val units: String,
        val addMl: Double,
        val dayEnd: Long,
    ) {
        val reached: Boolean get() = goalMl > 0 && totalMl >= goalMl - GOAL_TOLERANCE_ML
        val fraction: Double get() = if (goalMl > 0) totalMl / goalMl else 0.0
    }

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveSummary(ctx: Context, json: String) {
        synchronized(lock) { prefs(ctx).edit().putString(K_SUMMARY, json).commit() }
    }

    fun summary(ctx: Context): Summary? {
        val raw = prefs(ctx).getString(K_SUMMARY, null) ?: return null
        return try {
            val o = JSONObject(raw)
            val units = if (o.optString("units", "oz") == "ml") "ml" else "oz"
            val goal = o.optDouble("goalMl", 0.0)
            Summary(
                totalMl = o.optDouble("totalMl", 0.0),
                goalMl = goal,
                baseGoalMl = o.optDouble("baseGoalMl", goal),
                units = units,
                dayEndMin = o.optInt("dayEndMin", 180),
                dayStart = o.optLong("dayStart", 0L),
                dayEnd = o.optLong("dayEnd", 0L),
                addMl = o.optDouble("addMl", if (units == "ml") 250.0 else 8 * ML_PER_OZ),
            )
        } catch (e: JSONException) {
            null
        }
    }

    private fun readPending(ctx: Context): JSONArray =
        try {
            JSONArray(prefs(ctx).getString(K_PENDING, "[]") ?: "[]")
        } catch (e: JSONException) {
            JSONArray()
        }

    /** Adds one drink logged from the widget. Returns false if the list is full (app not opened in ages). */
    fun addPending(ctx: Context, ts: Long, ml: Double): Boolean {
        synchronized(lock) {
            val arr = readPending(ctx)
            if (arr.length() >= MAX_PENDING) return false
            arr.put(JSONObject().put("ts", ts).put("ml", ml))
            prefs(ctx).edit().putString(K_PENDING, arr.toString()).commit()
            return true
        }
    }

    /** Hands the pending drinks to the app and clears them, in one step. */
    fun takePending(ctx: Context): JSONArray {
        synchronized(lock) {
            val arr = readPending(ctx)
            prefs(ctx).edit().remove(K_PENDING).commit()
            return arr
        }
    }

    /** Start of the Hydrippo day that begins on [date], as epoch millis. */
    fun dayStartOf(date: LocalDate, dayEndMin: Int, zone: ZoneId): Long =
        date.atStartOfDay().plusMinutes(dayEndMin.toLong()).atZone(zone).toInstant().toEpochMilli()

    /** [start, end) of the Hydrippo day containing [now]. */
    fun dayContaining(now: Long, dayEndMin: Int, zone: ZoneId = ZoneId.systemDefault()): LongArray {
        val calendarDay = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val date = if (now < dayStartOf(calendarDay, dayEndMin, zone)) calendarDay.minusDays(1) else calendarDay
        return longArrayOf(dayStartOf(date, dayEndMin, zone), dayStartOf(date.plusDays(1), dayEndMin, zone))
    }

    /** Today's numbers, including widget taps the app hasn't picked up yet. Null before the app is set up. */
    fun today(ctx: Context, now: Long = System.currentTimeMillis()): Today? {
        val s = summary(ctx) ?: return null
        val sameDay = now >= s.dayStart && now < s.dayEnd
        val range = if (sameDay) longArrayOf(s.dayStart, s.dayEnd) else dayContaining(now, s.dayEndMin)
        var total = if (sameDay) s.totalMl else 0.0
        val pending = readPending(ctx)
        for (i in 0 until pending.length()) {
            val p = pending.optJSONObject(i) ?: continue
            val ts = p.optLong("ts", 0L)
            if (ts >= range[0] && ts < range[1]) total += p.optDouble("ml", 0.0)
        }
        val goal = if (sameDay) s.goalMl else s.baseGoalMl
        return Today(total, goal, s.units, s.addMl, range[1])
    }

    /** "64 oz", "750 ml", "1.2 L". Same rounding as displayNumber/unitLabel in core.js. */
    fun format(ml: Double, units: String): String {
        if (units == "ml") {
            if (abs(ml) >= 1000) {
                val liters = jsRound(ml / 100.0) / 10.0
                val text = if (liters == Math.floor(liters)) liters.toLong().toString() else liters.toString()
                return "$text L"
            }
            return "${jsRound(ml / 10.0) * 10} ml"
        }
        return "${jsRound(ml / ML_PER_OZ)} oz"
    }

    // JavaScript's Math.round: halves round up (toward +infinity).
    private fun jsRound(x: Double): Long = Math.floor(x + 0.5).roundToLong()
}
