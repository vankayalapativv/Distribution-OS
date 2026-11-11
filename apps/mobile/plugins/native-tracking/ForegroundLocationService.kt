package __PACKAGE__.tracking

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.database.sqlite.SQLiteDatabase
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import __PACKAGE__.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

class ForegroundLocationService : Service() {
  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private var callback: LocationCallback? = null
  // Serializes ping uploads off the main thread so captures never block on the
  // network and two flushes can't overlap on the SQLite file.
  private val uploadExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun onCreate() {
    super.onCreate()
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopTracking()
        return START_NOT_STICKY
      }
      ACTION_POLL -> {
        if (isPastCutoff() || isSignedOut()) {
          stopTracking()
          return START_NOT_STICKY
        }
        // Fired by the wake-up alarm — works with the screen off / during Doze.
        startAsForeground()
        captureCurrentLocation()
        scheduleNextPoll()
        return START_STICKY
      }
      ACTION_START -> persistActiveSession(intent)
      ACTION_BOOT_RECOVERY -> {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_ACTIVE, false) || isSignedOut()) {
          stopSelf()
          return START_NOT_STICKY
        }
      }
    }

    if (isPastCutoff() || isSignedOut()) {
      stopTracking()
      return START_NOT_STICKY
    }

    startAsForeground()
    startLocationUpdates()
    scheduleNextPoll()
    enqueueWatchdog()
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    cancelNextPoll()
    callback?.let { fusedLocationClient.removeLocationUpdates(it) }
    callback = null
    uploadExecutor.shutdown()
    super.onDestroy()
  }

  private fun persistActiveSession(intent: Intent) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
      .putBoolean(KEY_ACTIVE, true)
      .putString(KEY_CLIENT_SESSION_ID, intent.getStringExtra(EXTRA_CLIENT_SESSION_ID))
      .putString(KEY_SERVER_SESSION_ID, intent.getStringExtra(EXTRA_SERVER_SESSION_ID))
      .putString(KEY_CAP_DATE_IST, intent.getStringExtra(EXTRA_CAP_DATE_IST))
      .putLong(KEY_STARTED_AT_MS, System.currentTimeMillis())
      .apply()
  }

  /** Current IST calendar date as "yyyy-MM-dd". */
  private fun istDateToday(): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("Asia/Kolkata")
    return fmt.format(Date())
  }

  /**
   * Midnight safety cap: a Sales-executive day self-stops once the IST date rolls
   * past the day it started on — the JS layer passes that start date ("yyyy-MM-dd")
   * on start; null/blank (Logistics runs) means no cap. There is no fixed-hour
   * cutoff anymore (the SE ends their own day with the in-app "End day" button).
   * Checked on every wake-up so the service kills itself even with the app swiped
   * away.
   */
  private fun isPastCutoff(): Boolean {
    val capDate = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(KEY_CAP_DATE_IST, null)
    if (capDate.isNullOrBlank()) return false
    // yyyy-MM-dd compares correctly as a string; the clock only moves forward.
    return istDateToday() > capDate
  }

  /**
   * Auth guard: the JS layer sets KEY_SIGNED_IN=false on logout. Default true, so
   * an already-logged-in install (flag absent) is never mistaken for signed out.
   * While signed out the service refuses to run and the boot receiver won't
   * restart it — tracking can't outlive a session even if the explicit stop was
   * missed (e.g. a crash mid-logout).
   */
  private fun isSignedOut(): Boolean {
    return !getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_SIGNED_IN, true)
  }

  private fun startAsForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle("Sri Aparajita day tracking on")
      .setContentText("Your route is recorded during your work day.")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build()
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Day tracking",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Shows while Sri Aparajita records work-day route locations."
    }
    manager.createNotificationChannel(channel)
  }

  private fun startLocationUpdates() {
    if (!hasLocationPermission()) {
      stopTracking()
      return
    }
    if (callback != null) return

    // setMaxUpdateDelayMillis enables hardware batching: the GNSS/network chip may
    // buffer fixes across a window while the AP is asleep/Doze-throttled and burst-
    // deliver them together, instead of the OS silently dropping a callback it can't
    // deliver in real time. onLocationResult already iterates the batch. This is the
    // primary fix for "lost the middle of a ride" — fixes taken mid-ride are recovered
    // from the buffer rather than never arriving. Docs are explicit the requested
    // interval is a target, not a guaranteed callback rate; batching is the sanctioned
    // recovery for that. ~one interval of slack keeps points ≤3–6 min late, never lost.
    val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, PING_INTERVAL_MS)
      .setMinUpdateIntervalMillis(MIN_PING_GAP_MS)
      .setMaxUpdateDelayMillis(PING_INTERVAL_MS)
      .setWaitForAccurateLocation(false)
      .build()
    callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        result.locations.sortedBy { it.time }.forEach { recordLocation(it) }
      }
    }
    fusedLocationClient.requestLocationUpdates(
      request,
      requireNotNull(callback),
      Looper.getMainLooper(),
    )
  }

  /**
   * A Handler-based delay timer is scheduled on CPU uptime, which FREEZES when
   * the screen turns off and the CPU enters deep sleep — so an idle phone stops
   * producing pings until the screen wakes the CPU again. A foreground service
   * keeps the process alive but does NOT keep the CPU awake. Use a wake-up alarm
   * instead: setExactAndAllowWhileIdle fires during sleep/Doze, briefly waking
   * the CPU each interval to capture a fix even when stationary with the screen
   * off. The alarm re-arms itself every time it fires (ACTION_POLL).
   */
  private fun scheduleNextPoll() {
    val alarmManager = getSystemService(AlarmManager::class.java) ?: return
    val triggerAt = SystemClock.elapsedRealtime() + PING_INTERVAL_MS
    val pending = pollPendingIntent()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
      } else {
        alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
      }
    } catch (_: SecurityException) {
      // Exact alarms not permitted on this device; the inexact "allow while idle"
      // variant still fires during Doze, which is fine for a ~3-minute cadence.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
      } else {
        alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
      }
    }
  }

  private fun cancelNextPoll() {
    getSystemService(AlarmManager::class.java)?.cancel(pollPendingIntent())
  }

  private fun pollPendingIntent(): PendingIntent {
    val intent = Intent(this, ForegroundLocationService::class.java).apply { action = ACTION_POLL }
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_IMMUTABLE
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      PendingIntent.getForegroundService(this, POLL_REQUEST_CODE, intent, flags)
    } else {
      PendingIntent.getService(this, POLL_REQUEST_CODE, intent, flags)
    }
  }

  private fun captureCurrentLocation() {
    if (!hasLocationPermission()) return
    try {
      // BALANCED_POWER uses network/wifi and returns a fix indoors, where
      // HIGH_ACCURACY waits for a GPS lock and returns null when the phone can't
      // see the sky. Fall back to the last known fix so a stationary phone still
      // records a point every interval.
      fusedLocationClient
        .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, CancellationTokenSource().token)
        .addOnSuccessListener { location ->
          if (location != null) {
            recordLocation(location, allowRestamp = true)
          } else {
            fusedLocationClient.lastLocation.addOnSuccessListener { last -> last?.let { recordLocation(it, allowRestamp = true) } }
          }
        }
    } catch (_: SecurityException) {
      // Permission revoked mid-session; the passive callback's permission check
      // and stopTracking() handle teardown.
    }
  }

  private fun hasLocationPermission(): Boolean {
    return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
  }

  private fun stopTracking() {
    cancelNextPoll()
    cancelWatchdog()
    callback?.let { fusedLocationClient.removeLocationUpdates(it) }
    callback = null
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
      .putBoolean(KEY_ACTIVE, false)
      .apply()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  /**
   * Schedule the periodic WorkManager backstop that re-launches this service if
   * it gets killed while a day is still active (see TrackingWatchdogWorker).
   * KEEP so repeated starts don't reset the 15-minute cycle.
   */
  private fun enqueueWatchdog() {
    try {
      val request = PeriodicWorkRequestBuilder<TrackingWatchdogWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(this)
        .enqueueUniquePeriodicWork(WATCHDOG_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    } catch (_: Exception) {
      // WorkManager unavailable — the alarm + boot-receiver paths still apply.
    }
  }

  private fun cancelWatchdog() {
    try {
      WorkManager.getInstance(this).cancelUniqueWork(WATCHDOG_WORK)
    } catch (_: Exception) {
    }
  }

  /**
   * @param allowRestamp only the alarm-poll safety net passes true. The continuous
   * callback keeps its fixes at their true times; the poll path may fall back to a
   * slightly-stale fix, and without this a window that got only that stale fix would
   * be dropped by dedup and left EMPTY — a gap in the route. When the interval is
   * overdue AND the fix is genuinely recent (age < MAX_FIX_AGE_MS, so we never
   * fabricate a position from an ancient lastLocation), re-stamp it to wall-clock so
   * it counts. Mirrors the JS guardedRecordMs the native side previously lacked.
   * Continuity > accuracy: better a slightly-recent point than a straight-line jump.
   */
  private fun recordLocation(location: Location, allowRestamp: Boolean = false) {
    if (isPastCutoff() || isSignedOut()) {
      stopTracking()
      return
    }
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val lastKeptMs = prefs.getLong(KEY_LAST_KEPT_MS, 0L)
    val nowMs = System.currentTimeMillis()
    var effectiveTimeMs = location.time
    val fixAgeMs = nowMs - location.time
    val overdue = nowMs - lastKeptMs >= OVERDUE_GAP_MS
    if (allowRestamp && overdue && fixAgeMs in 0 until MAX_FIX_AGE_MS) {
      effectiveTimeMs = nowMs
    }
    if (effectiveTimeMs - lastKeptMs < MIN_PING_GAP_MS) return

    val databaseFile = File(filesDir, "SQLite/sri-aparajita.db").apply {
      parentFile?.mkdirs()
    }
    val db = SQLiteDatabase.openOrCreateDatabase(databaseFile, null)
    try {
      ensureGpsTable(db)
      db.execSQL(
        """
          insert or ignore into gps_pings (
            location_point_id,
            client_session_id,
            latitude,
            longitude,
            accuracy,
            battery_percentage,
            recorded_at,
            created_at,
            sync_status,
            rejection_reason,
            synced
          ) values (?, ?, ?, ?, ?, null, ?, ?, 'pending', null, 0)
        """.trimIndent(),
        arrayOf<Any?>(
          UUID.randomUUID().toString(),
          prefs.getString(KEY_CLIENT_SESSION_ID, null),
          location.latitude,
          location.longitude,
          if (location.hasAccuracy()) location.accuracy.toDouble() else null,
          isoUtc(effectiveTimeMs),
          nowMs,
        ),
      )
      prefs.edit().putLong(KEY_LAST_KEPT_MS, effectiveTimeMs).apply()
    } finally {
      db.close()
    }
    // Push the point (and any earlier queued ones) to the server ourselves, off
    // the main thread. This is what makes tracking LIVE while the app is
    // backgrounded/killed — the JS sync engine is suspended then and can't upload.
    if (!uploadExecutor.isShutdown) uploadExecutor.submit { uploadPendingPings() }
  }

  /**
   * Flush unsynced pings to the server directly from the service. Runs on the
   * upload executor. Best-effort: on any failure (no token yet, offline, DB
   * locked) the rows stay `pending` and the next capture — or the JS sync engine
   * when the app is next foregrounded — retries them. Idempotent: the server
   * dedupes by location_point_id, so an overlap with a JS flush is harmless.
   */
  private fun uploadPendingPings() {
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val token = prefs.getString(KEY_AUTH_TOKEN, null) ?: return
    val baseUrl = prefs.getString(KEY_BASE_URL, null)?.trimEnd('/') ?: return
    val serverSessionId = prefs.getString(KEY_SERVER_SESSION_ID, null)
    val databaseFile = File(filesDir, "SQLite/sri-aparajita.db")
    if (!databaseFile.exists()) return
    val db = SQLiteDatabase.openOrCreateDatabase(databaseFile, null)
    try {
      ensureGpsTable(db)
      val points = JSONArray()
      var maxId = -1L
      db.rawQuery(
        """
          select id, location_point_id, latitude, longitude, accuracy, battery_percentage, recorded_at
          from gps_pings
          where synced = 0 and sync_status in ('pending', 'retry')
          order by id limit 100
        """.trimIndent(),
        null,
      ).use { cursor ->
        while (cursor.moveToNext()) {
          val id = cursor.getLong(0)
          val obj = JSONObject()
          obj.put("locationPointId", cursor.getString(1))
          obj.put("latitude", cursor.getDouble(2))
          obj.put("longitude", cursor.getDouble(3))
          obj.put("accuracy", if (cursor.isNull(4)) JSONObject.NULL else cursor.getDouble(4))
          obj.put("batteryPercentage", if (cursor.isNull(5)) JSONObject.NULL else cursor.getInt(5))
          obj.put("recordedAt", cursor.getString(6))
          points.put(obj)
          if (id > maxId) maxId = id
        }
      }
      if (points.length() == 0) return
      val body = JSONObject().put("points", points).toString()
      // Same routing as the JS sync engine: session batch when we have a server
      // session id, otherwise the user-scoped visits fallback.
      val url = if (serverSessionId != null) {
        "$baseUrl/tracking-sessions/$serverSessionId/points/batch"
      } else {
        "$baseUrl/visits/gps/batch"
      }
      if (postJson(url, token, body)) {
        db.execSQL(
          "update gps_pings set synced = 1, sync_status = 'accepted' " +
            "where synced = 0 and sync_status in ('pending', 'retry') and id <= ?",
          arrayOf<Any?>(maxId),
        )
      }
    } catch (_: Exception) {
      // Transient (locked DB / offline / server error) — leave rows pending.
    } finally {
      db.close()
    }
  }

  private fun postJson(urlStr: String, token: String, body: String): Boolean {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 20_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      val code = conn.responseCode
      // Drain the stream so the socket can be reused.
      (if (code in 200..299) conn.inputStream else conn.errorStream)?.use { it.readBytes() }
      code in 200..299
    } catch (_: Exception) {
      false
    } finally {
      conn?.disconnect()
    }
  }

  private fun ensureGpsTable(db: SQLiteDatabase) {
    db.execSQL(
      """
        create table if not exists gps_pings (
          id integer primary key autoincrement,
          location_point_id text not null unique,
          client_session_id text,
          latitude real not null,
          longitude real not null,
          accuracy real,
          battery_percentage real,
          recorded_at text not null,
          created_at integer not null,
          sync_status text not null default 'pending',
          rejection_reason text,
          synced integer not null default 0
        )
      """.trimIndent(),
    )
    db.execSQL("create index if not exists gps_pings_unsynced on gps_pings (synced, id)")
    db.execSQL("create index if not exists gps_pings_sync_status on gps_pings (sync_status, id)")
  }

  private fun isoUtc(timeMs: Long): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("UTC")
    return fmt.format(Date(timeMs))
  }

  companion object {
    const val ACTION_START = "__PACKAGE__.tracking.START"
    const val ACTION_STOP = "__PACKAGE__.tracking.STOP"
    const val ACTION_POLL = "__PACKAGE__.tracking.POLL"
    const val ACTION_BOOT_RECOVERY = "__PACKAGE__.tracking.BOOT_RECOVERY"
    const val EXTRA_CLIENT_SESSION_ID = "clientSessionId"
    const val EXTRA_SERVER_SESSION_ID = "serverSessionId"
    const val EXTRA_CAP_DATE_IST = "capDateIst"
    const val KEY_CAP_DATE_IST = "capDateIst"
    const val PREFS_NAME = "beyond_native_tracking"
    const val KEY_ACTIVE = "active"
    const val KEY_SIGNED_IN = "signedIn"
    const val KEY_CLIENT_SESSION_ID = "clientSessionId"
    const val KEY_SERVER_SESSION_ID = "serverSessionId"
    const val KEY_AUTH_TOKEN = "authToken"
    const val KEY_BASE_URL = "baseUrl"
    const val KEY_STARTED_AT_MS = "startedAtMs"
    private const val KEY_LAST_KEPT_MS = "lastKeptMs"
    private const val WATCHDOG_WORK = "beyond_tracking_watchdog"
    private const val CHANNEL_ID = "day_tracking"
    private const val NOTIFICATION_ID = 4107
    private const val POLL_REQUEST_CODE = 4108
    private const val PING_INTERVAL_MS = 180_000L
    private const val MIN_PING_GAP_MS = 150_000L
    // A window is "overdue" once nothing has been kept for >4 min (a missed interval).
    // Only then does the alarm-poll re-stamp a fresh-but-stale-timestamped fix, so
    // normal ~3-min cadence keeps real fix times and re-stamping is the recovery path.
    private const val OVERDUE_GAP_MS = 240_000L
    // Never re-stamp a fix older than this — better a gap than a fabricated position.
    private const val MAX_FIX_AGE_MS = 150_000L
  }
}
