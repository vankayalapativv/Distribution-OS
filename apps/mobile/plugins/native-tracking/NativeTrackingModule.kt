package __PACKAGE__.tracking

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeTrackingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NativeTracking"

  @ReactMethod
  fun startForegroundTracking(clientSessionId: String?, serverSessionId: String?, capDateIst: String?, promise: Promise) {
    try {
      val intent = Intent(reactContext, ForegroundLocationService::class.java).apply {
        action = ForegroundLocationService.ACTION_START
        putExtra(ForegroundLocationService.EXTRA_CLIENT_SESSION_ID, clientSessionId)
        putExtra(ForegroundLocationService.EXTRA_SERVER_SESSION_ID, serverSessionId)
        putExtra(ForegroundLocationService.EXTRA_CAP_DATE_IST, capDateIst)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NATIVE_TRACKING_START_FAILED", e)
    }
  }

  @ReactMethod
  fun stopForegroundTracking(promise: Promise) {
    try {
      val intent = Intent(reactContext, ForegroundLocationService::class.java).apply {
        action = ForegroundLocationService.ACTION_STOP
      }
      reactContext.startService(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NATIVE_TRACKING_STOP_FAILED", e)
    }
  }

  /**
   * Mirror the JS auth session into the tracking service's prefs. Set false on
   * logout so the service (and the boot receiver) refuse to run while signed
   * out; true on login / app start. Persisted so it survives a process restart.
   */
  @ReactMethod
  fun setSignedIn(signedIn: Boolean, promise: Promise) {
    try {
      val editor = reactContext
        .getSharedPreferences(ForegroundLocationService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(ForegroundLocationService.KEY_SIGNED_IN, signedIn)
      // Drop the stored auth token on logout so the service can't upload with a
      // stale/foreign session after the account signs out.
      if (!signedIn) editor.remove(ForegroundLocationService.KEY_AUTH_TOKEN)
      editor.apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NATIVE_TRACKING_SET_SIGNED_IN_FAILED", e)
    }
  }

  /**
   * Give the tracking service what it needs to upload pings on its own (without
   * the JS app being foregrounded): the API base URL and a bearer token (7-day
   * TTL). Called on login / app start / day start; the token is cleared on
   * logout via setSignedIn(false).
   */
  @ReactMethod
  fun setUploadContext(token: String?, baseUrl: String?, promise: Promise) {
    try {
      val editor = reactContext
        .getSharedPreferences(ForegroundLocationService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
      if (token != null) editor.putString(ForegroundLocationService.KEY_AUTH_TOKEN, token)
      else editor.remove(ForegroundLocationService.KEY_AUTH_TOKEN)
      if (baseUrl != null) editor.putString(ForegroundLocationService.KEY_BASE_URL, baseUrl)
      editor.apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NATIVE_TRACKING_SET_UPLOAD_CONTEXT_FAILED", e)
    }
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      val ignoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.isIgnoringBatteryOptimizations(reactContext.packageName)
      } else {
        true
      }
      promise.resolve(ignoring)
    } catch (e: Exception) {
      promise.reject("BATTERY_OPT_CHECK_FAILED", e)
    }
  }

  @SuppressLint("BatteryLife")
  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(reactContext.packageName)) {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:" + reactContext.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          reactContext.startActivity(intent)
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BATTERY_OPT_REQUEST_FAILED", e)
    }
  }

  /**
   * Open the vendor "Auto-start / background start" whitelist screen. Xiaomi,
   * vivo, Oppo/Realme, OnePlus and Huawei battery managers kill a foreground
   * service even when it's exempt from battery optimization unless the app is on
   * this list — the fleet data shows vivo dropping most of a day's pings. There
   * is no standard intent, so we try each known OEM component in turn and fall
   * back to the app's own details screen (where the toggle lives on many skins).
   * The whitelist state can't be read back, so JS prompts this once per install.
   */
  @ReactMethod
  fun openAutostartSettings(promise: Promise) {
    val candidates = listOf(
      // Xiaomi / Redmi / POCO — MIUI / HyperOS
      ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      // Oppo / Realme — ColorOS
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
      // vivo / iQOO — FuntouchOS / OriginOS
      ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
      // OnePlus — OxygenOS
      ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
      // Huawei / Honor
      ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    )
    for (component in candidates) {
      try {
        val intent = Intent().apply {
          this.component = component
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
        promise.resolve(true)
        return
      } catch (_: Exception) {
        // Not this OEM (activity missing or not exported) — try the next.
      }
    }
    // Fallback: the app's own details screen so the SE can still reach the
    // Auto-start / background-activity toggle their skin puts there.
    try {
      val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:" + reactContext.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(fallback)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("AUTOSTART_OPEN_FAILED", e)
    }
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      val can = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.canScheduleExactAlarms()
      } else {
        true
      }
      promise.resolve(can)
    } catch (e: Exception) {
      promise.reject("EXACT_ALARM_CHECK_FAILED", e)
    }
  }

  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:" + reactContext.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("EXACT_ALARM_OPEN_FAILED", e)
    }
  }
}
