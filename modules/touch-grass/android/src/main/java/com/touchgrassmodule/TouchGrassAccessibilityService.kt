package com.touchgrassmodule

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Context
import android.content.Intent
import android.util.Log

class TouchGrassAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            
            // Bypass ourselves and standard system UI elements
            if (packageName == "com.touchgrass" || packageName == "com.android.systemui" || packageName == "com.android.settings") {
                return
            }

            val prefs = getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
            val isLocked = prefs.getBoolean("is_locked", false)
            val lockUntil = prefs.getLong("lock_until", 0L)
            val currentTime = System.currentTimeMillis()

            // If lock is still active
            val activeLock = isLocked && (lockUntil > currentTime)

            if (activeLock) {
                val blockedPackagesString = prefs.getString("blocked_packages", "") ?: ""
                val blockedPackages = blockedPackagesString.split(",").map { it.trim() }.filter { it.isNotEmpty() }

                if (blockedPackages.contains(packageName)) {
                    Log.d("TouchGrassShield", "Intercepted unauthorized launch: $packageName")
                    
                    // Redirect to TouchGrass launcher activity
                    val launchIntent = packageManager.getLaunchIntentForPackage("com.touchgrass")
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        launchIntent.putExtra("blocked_package", packageName)
                        
                        // Save the triggered blocked package in preferences so React Native can query it
                        prefs.edit().putString("active_blocked_package", packageName).apply()
                        
                        startActivity(launchIntent)
                    }
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.d("TouchGrassShield", "Service Interrupted")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("TouchGrassShield", "Service Connected and Monitoring Packages")
    }
}
