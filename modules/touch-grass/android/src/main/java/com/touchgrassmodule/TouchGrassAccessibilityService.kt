package com.touchgrassmodule

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar

class TouchGrassAccessibilityService : AccessibilityService() {

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var lastSeenPackage: String? = null

    private val checkRunnable = object : Runnable {
        override fun run() {
            try {
                val rootNode = rootInActiveWindow
                val activePackage = rootNode?.packageName?.toString() ?: lastSeenPackage
                if (activePackage != null) {
                    checkAndRedirectIfNeeded(activePackage)
                }
            } catch (e: Exception) {
                Log.e("TouchGrassShield", "Error in periodic background check", e)
            }
            handler.postDelayed(this, 500)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString()
        if (packageName != null && packageName != "com.touchgrass" && packageName != "com.android.systemui" && packageName != "com.android.settings") {
            lastSeenPackage = packageName
        }

        val eventType = event.eventType
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || 
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED ||
            eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            
            val eventPackage = event.packageName?.toString() ?: return
            checkAndRedirectIfNeeded(eventPackage)
        }
    }

    private fun checkAndRedirectIfNeeded(packageName: String) {
        // Bypass ourselves and standard system UI elements
        if (packageName == "com.touchgrass" || packageName == "com.android.systemui" || packageName == "com.android.settings") {
            return
        }

        val prefs = getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("is_locked", false)
        val lockUntil = prefs.getLong("lock_until", 0L)
        val currentTime = System.currentTimeMillis()

        // Check if manual lock is active
        var activeLock = isLocked && (lockUntil > currentTime)

        val globalEnabled = prefs.getBoolean("global_lock_enabled", false)

        // Date and time bypass protection
        val autoTimeEnabled = isAutoTimeEnabled(this)
        if (!autoTimeEnabled && (isLocked || globalEnabled)) {
            // Force lock because they tampered with the system clock!
            activeLock = true
        } else {
            // If not active, check if global lockdown window is active
            if (!activeLock) {
                if (globalEnabled) {
                    val startStr = prefs.getString("global_lock_start", "") ?: ""
                    val endStr = prefs.getString("global_lock_end", "") ?: ""
                    if (startStr.isNotEmpty() && endStr.isNotEmpty()) {
                        if (isCurrentTimeInWindow(startStr, endStr)) {
                            activeLock = true
                        }
                    }
                }
            }
        }

        if (activeLock) {
            val blockedPackagesString = prefs.getString("blocked_packages", "") ?: ""
            val blockedPackages = blockedPackagesString.split(",").map { it.trim() }.filter { it.isNotEmpty() }

            if (blockedPackages.contains(packageName)) {
                Log.d("TouchGrassShield", "Intercepted unauthorized launch: $packageName")
                
                // Redirect to TouchGrass launcher activity
                val launchIntent = packageManager.getLaunchIntentForPackage("com.touchgrass")
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    launchIntent.putExtra("blocked_package", packageName)
                    
                    // Save the triggered blocked package in preferences so React Native can query it
                    prefs.edit().putString("active_blocked_package", packageName).apply()
                    
                    startActivity(launchIntent)
                }
            }
        }
    }

    private fun isCurrentTimeInWindow(start: String, end: String): Boolean {
        try {
            val startParts = start.split(":")
            val endParts = end.split(":")
            if (startParts.size != 2 || endParts.size != 2) return false

            val startH = startParts[0].toInt()
            val startM = startParts[1].toInt()
            val endH = endParts[0].toInt()
            val endM = endParts[1].toInt()

            val now = Calendar.getInstance()
            val nowH = now.get(Calendar.HOUR_OF_DAY)
            val nowM = now.get(Calendar.MINUTE)

            val startTimeMinutes = startH * 60 + startM
            val endTimeMinutes = endH * 60 + endM
            val nowTimeMinutes = nowH * 60 + nowM

            return if (endTimeMinutes > startTimeMinutes) {
                // Same day lock window, e.g., 09:00 to 17:00
                nowTimeMinutes in startTimeMinutes..endTimeMinutes
            } else {
                // Overnight lock window, e.g., 22:00 to 06:00
                nowTimeMinutes >= startTimeMinutes || nowTimeMinutes <= endTimeMinutes
            }
        } catch (e: Exception) {
            return false
        }
    }

    private fun isAutoTimeEnabled(context: Context): Boolean {
        return try {
            val autoTime = android.provider.Settings.Global.getInt(
                context.contentResolver,
                android.provider.Settings.Global.AUTO_TIME,
                1
            )
            val autoTimeZone = android.provider.Settings.Global.getInt(
                context.contentResolver,
                android.provider.Settings.Global.AUTO_TIME_ZONE,
                1
            )
            autoTime == 1 && autoTimeZone == 1
        } catch (e: Exception) {
            true
        }
    }

    override fun onInterrupt() {
        Log.d("TouchGrassShield", "Service Interrupted")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("TouchGrassShield", "Service Connected and Monitoring Packages")
        handler.post(checkRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(checkRunnable)
    }
}
