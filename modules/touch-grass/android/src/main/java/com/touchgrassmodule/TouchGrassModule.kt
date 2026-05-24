package com.touchgrassmodule

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import android.util.Base64
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TouchGrassModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("TouchGrassModule")

    Function("isAccessibilityServiceEnabled") {
      appContext.reactContext?.let { context ->
        val expectedServiceName = context.packageName + "/" + TouchGrassAccessibilityService::class.java.name
        var accessibilityEnabled = 0
        try {
          accessibilityEnabled = Settings.Secure.getInt(
            context.contentResolver,
            Settings.Secure.ACCESSIBILITY_ENABLED
          )
        } catch (e: Exception) {
          // Fallback
        }

        val mStringColonSplitter = TextUtils.SimpleStringSplitter(':')
        if (accessibilityEnabled == 1) {
          val settingValue = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
          )
          if (settingValue != null) {
            mStringColonSplitter.setString(settingValue)
            while (mStringColonSplitter.hasNext()) {
              val accessibilityService = mStringColonSplitter.next()
              if (accessibilityService.equals(expectedServiceName, ignoreCase = true)) {
                return@let true
              }
            }
          }
        }
        false
      } ?: false
    }

    Function("openAccessibilitySettings") {
      appContext.reactContext?.let { context ->
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    Function("isOverlayPermissionGranted") {
      appContext.reactContext?.let { context ->
        Settings.canDrawOverlays(context)
      } ?: false
    }

    Function("openOverlaySettings") {
      appContext.reactContext?.let { context ->
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          android.net.Uri.parse("package:" + context.packageName)
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    Function("updateLockState") { isLocked: Boolean, lockUntilMs: Double, blockedPackages: String ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
          putBoolean("is_locked", isLocked)
          putLong("lock_until", lockUntilMs.toLong())
          putString("blocked_packages", blockedPackages)
          apply()
        }
      }
    }

    Function("getLockState") {
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        mapOf<String, Any>(
          "isLocked" to prefs.getBoolean("is_locked", false),
          "lockUntil" to prefs.getLong("lock_until", 0L).toDouble(),
          "blockedPackages" to (prefs.getString("blocked_packages", "") ?: "")
        )
      } ?: mapOf<String, Any>("isLocked" to false, "lockUntil" to 0.0, "blockedPackages" to "")
    }

    Function("getActiveBlockedPackage") {
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        prefs.getString("active_blocked_package", "") ?: ""
      } ?: ""
    }

    Function("clearActiveBlockedPackage") {
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("TouchGrassPrefs", Context.MODE_PRIVATE)
        prefs.edit().remove("active_blocked_package").apply()
      }
    }

    Function("getInstalledApps") {
      appContext.reactContext?.let { context ->
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
          addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos = pm.queryIntentActivities(intent, 0)
        val appsList = mutableListOf<Map<String, Any>>()

        for (resolveInfo in resolveInfos) {
          val packageName = resolveInfo.activityInfo.packageName
          val appName = resolveInfo.loadLabel(pm).toString()
          
          // Skip ourselves
          if (packageName == context.packageName) continue

          // Convert drawable app icon to base64
          var base64Icon = ""
          try {
            val iconDrawable = resolveInfo.loadIcon(pm)
            val bitmap = drawableToBitmap(iconDrawable)
            val byteArrayOutputStream = java.io.ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 80, byteArrayOutputStream)
            val byteArray = byteArrayOutputStream.toByteArray()
            base64Icon = android.util.Base64.encodeToString(byteArray, android.util.Base64.NO_WRAP)
          } catch (e: Exception) {
            // Fallback to empty icon
          }

          appsList.add(
            mapOf<String, Any>(
              "packageName" to packageName,
              "label" to appName,
              "iconBase64" to base64Icon
            )
          )
        }
        appsList
      } ?: emptyList<Map<String, Any>>()
    }
  }

  private fun drawableToBitmap(drawable: Drawable): Bitmap {
    if (drawable is BitmapDrawable) {
      if (drawable.bitmap != null) {
        return drawable.bitmap
      }
    }
    
    val bitmap = if (drawable.intrinsicWidth <= 0 || drawable.intrinsicHeight <= 0) {
      Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
    } else {
      Bitmap.createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight, Bitmap.Config.ARGB_8888)
    }
    
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)
    return bitmap
  }
}
