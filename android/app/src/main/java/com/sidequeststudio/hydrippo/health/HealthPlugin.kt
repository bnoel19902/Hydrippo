package com.sidequeststudio.hydrippo.health

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Volume
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId

/**
 * Optional Health Connect sync (Settings > Your data). Write-only: Hydrippo adds the drinks you
 * log as HydrationRecords and never reads health data.
 *
 * Each record's clientRecordId is "hydrippo-<entry id>", so editing a drink in the app replaces
 * its record and deleting a drink removes it. Which drinks to send is decided in JavaScript
 * (core.js hcPlan); this plugin only writes and deletes what it is given.
 *
 * JavaScript side: window.Capacitor.Plugins.HydrippoHealth (see www/js/platform.js).
 */
@CapacitorPlugin(name = "HydrippoHealth")
class HealthPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissions = setOf(HealthPermission.getWritePermission(HydrationRecord::class))
    private val permissionContract = PermissionController.createRequestPermissionResultContract()

    private fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context)
    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    /** { available: true } or { available: false, reason: "update" | "unavailable" } */
    @PluginMethod
    fun availability(call: PluginCall) {
        val ret = JSObject()
        when (sdkStatus()) {
            HealthConnectClient.SDK_AVAILABLE -> ret.put("available", true)
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                ret.put("available", false)
                ret.put("reason", "update")
            }
            else -> {
                ret.put("available", false)
                ret.put("reason", "unavailable")
            }
        }
        call.resolve(ret)
    }

    /** Opens Google Play on Health Connect so it can be installed or updated (Android 13 and older). */
    @PluginMethod
    fun openInstall(call: PluginCall) {
        val uri = Uri.parse("market://details?id=$PROVIDER&url=healthconnect%3A%2F%2Fonboarding")
        val intent = Intent(Intent.ACTION_VIEW, uri)
            .setPackage("com.android.vending")
            .putExtra("overlay", true)
            .putExtra("callerId", context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
        call.resolve()
    }

    /** { granted: boolean }. Shows Health Connect's permission screen if needed. */
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (sdkStatus() != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(grantedResult(false))
            return
        }
        scope.launch {
            try {
                val granted = client().permissionController.getGrantedPermissions()
                if (granted.containsAll(permissions)) {
                    call.resolve(grantedResult(true))
                } else {
                    val intent = permissionContract.createIntent(context, permissions)
                    startActivityForResult(call, intent, "onPermissionResult")
                }
            } catch (e: Exception) {
                call.reject("Health Connect could not be opened", "unavailable", e)
            }
        }
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val granted = permissionContract.parseResult(result.resultCode, result.data)
        call.resolve(grantedResult(granted.containsAll(permissions)))
    }

    /** records: [{ id, ts, ml }] -> inserted or updated in Health Connect. */
    @PluginMethod
    fun writeHydration(call: PluginCall) {
        val input = call.getArray("records") ?: JSArray()
        val version = System.currentTimeMillis() // higher than any earlier write, so updates win
        val zone = ZoneId.systemDefault()
        val records = ArrayList<Record>()
        for (i in 0 until input.length()) {
            val o = input.optJSONObject(i) ?: continue
            val id = o.optString("id", "")
            val ts = o.optLong("ts", 0L)
            val ml = o.optDouble("ml", 0.0)
            if (id.isEmpty() || ts <= 0L || ml.isNaN() || ml <= 0.0 || ml > MAX_ML) continue
            val start = Instant.ofEpochMilli(ts)
            val end = start.plusSeconds(60) // a drink is a one-minute interval
            records.add(
                HydrationRecord(
                    startTime = start,
                    startZoneOffset = zone.rules.getOffset(start),
                    endTime = end,
                    endZoneOffset = zone.rules.getOffset(end),
                    volume = Volume.milliliters(ml),
                    metadata = Metadata.manualEntry(clientRecordId = PREFIX + id, clientRecordVersion = version),
                ),
            )
        }
        if (records.isEmpty()) {
            call.resolve(countResult(0))
            return
        }
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    for (chunk in records.chunked(CHUNK)) client().insertRecords(chunk)
                }
                call.resolve(countResult(records.size))
            } catch (e: SecurityException) {
                call.reject("Health Connect permission was removed", "denied", e)
            } catch (e: Exception) {
                call.reject("Could not write to Health Connect", "failed", e)
            }
        }
    }

    /** ids: [entry id] -> their records are removed from Health Connect. */
    @PluginMethod
    fun deleteHydration(call: PluginCall) {
        val input = call.getArray("ids") ?: JSArray()
        val ids = ArrayList<String>()
        for (i in 0 until input.length()) {
            val id = input.optString(i, "")
            if (id.isNotEmpty()) ids.add(PREFIX + id)
        }
        if (ids.isEmpty()) {
            call.resolve(countResult(0))
            return
        }
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    for (chunk in ids.chunked(CHUNK)) {
                        client().deleteRecords(HydrationRecord::class, recordIdsList = emptyList(), clientRecordIdsList = chunk)
                    }
                }
                call.resolve(countResult(ids.size))
            } catch (e: SecurityException) {
                call.reject("Health Connect permission was removed", "denied", e)
            } catch (e: Exception) {
                call.reject("Could not delete from Health Connect", "failed", e)
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    private fun grantedResult(granted: Boolean): JSObject {
        val ret = JSObject()
        ret.put("granted", granted)
        return ret
    }

    private fun countResult(n: Int): JSObject {
        val ret = JSObject()
        ret.put("count", n)
        return ret
    }

    companion object {
        private const val PROVIDER = "com.google.android.apps.healthdata"
        private const val PREFIX = "hydrippo-"
        private const val CHUNK = 500
        private const val MAX_ML = 100_000.0 // Health Connect's limit for one drink (100 L)
    }
}
