package com.sidequeststudio.hydrippo.widget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * JavaScript side: window.Capacitor.Plugins.HydrippoWidget (see www/js/platform.js).
 *   update(summary)  - app -> widget: today's total, goal, day boundaries, units, button size
 *   takePending()    - widget -> app: { logs: [{ ts, ml }] } logged from the home screen
 */
@CapacitorPlugin(name = "HydrippoWidget")
class WidgetPlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        WidgetStore.saveSummary(context, call.data.toString())
        HydrippoWidgetProvider.refreshAll(context)
        call.resolve()
    }

    @PluginMethod
    fun takePending(call: PluginCall) {
        val logs = WidgetStore.takePending(context)
        val ret = JSObject()
        ret.put("logs", logs)
        // No widget redraw here: the app adds these to its log and calls update() right after.
        call.resolve(ret)
    }
}
