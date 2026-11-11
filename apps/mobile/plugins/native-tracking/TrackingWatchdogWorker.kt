package __PACKAGE__.tracking

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Backstop restart for the tracking service, independent of the app being open.
 *
 * The wake-up alarm (ACTION_POLL) and the boot receiver already recover the
 * service after most kills, but a dropped exact alarm on an aggressive OEM would
 * otherwise leave tracking dead until the SE reopens the app. This periodic job
 * (every ~15 min — WorkManager's minimum) re-launches the service whenever a day
 * is still active and signed in and the cutoff hasn't passed. It reuses the
 * service's ACTION_BOOT_RECOVERY path, which is a no-op when the service is
 * already running, so repeated ticks are harmless.
 *
 * Starting a foreground service from the background is allowed here because the
 * Start-day flow requires the battery-optimization exemption, which grants that
 * exemption; if a device still blocks it, the alarm/boot paths remain.
 */
class TrackingWatchdogWorker(context: Context, params: WorkerParameters) :
  Worker(context, params) {

  override fun doWork(): Result {
    val prefs = applicationContext.getSharedPreferences(
      ForegroundLocationService.PREFS_NAME,
      Context.MODE_PRIVATE,
    )
    if (!prefs.getBoolean(ForegroundLocationService.KEY_ACTIVE, false)) return Result.success()
    if (!prefs.getBoolean(ForegroundLocationService.KEY_SIGNED_IN, true)) return Result.success()

    // Don't resurrect a day whose IST date has already rolled past its start day
    // (the midnight cap). Blank cap date (Logistics) → no cap.
    val capDate = prefs.getString(ForegroundLocationService.KEY_CAP_DATE_IST, null)
    if (!capDate.isNullOrBlank()) {
      val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
      fmt.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
      if (fmt.format(Date()) > capDate) return Result.success()
    }

    val intent = Intent(applicationContext, ForegroundLocationService::class.java).apply {
      action = ForegroundLocationService.ACTION_BOOT_RECOVERY
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        applicationContext.startForegroundService(intent)
      } else {
        applicationContext.startService(intent)
      }
    } catch (_: Exception) {
      // Background FGS start blocked in this state — alarm/boot paths remain.
    }
    return Result.success()
  }
}
