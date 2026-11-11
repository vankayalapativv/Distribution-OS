import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { mobileRoot, read } from "./android-native-tracking.support";

describe("Android native tracking service (capture + upload)", () => {
  test("uses FusedLocationProviderClient and stores points in Expo SQLite's queue", () => {
    // The template is the committed source of truth (package-agnostic); the
    // generated android/ tree is gitignored and its package path follows
    // expo.android.package, so derive it rather than hard-coding, and only
    // assert on it when a local prebuild has produced it.
    const serviceTemplate = read("plugins/native-tracking/ForegroundLocationService.kt");
    expect(serviceTemplate).toContain('File(filesDir, "SQLite/distribution-os.db")');
    expect(serviceTemplate).not.toContain('openOrCreateDatabase("distribution-os.db"');
    expect(serviceTemplate).toContain("FusedLocationProviderClient");
    expect(serviceTemplate).toContain("requestLocationUpdates");
    expect(serviceTemplate).toContain("insert or ignore into gps_pings");

    const pkgPath = (JSON.parse(read("app.json")).expo.android.package as string).replace(/\./g, "/");
    const genRoot = `android/app/src/main/java/${pkgPath}`;
    if (!existsSync(join(mobileRoot, `${genRoot}/tracking/ForegroundLocationService.kt`))) return;

    const buildGradle = read("android/app/build.gradle");
    const service = read(`${genRoot}/tracking/ForegroundLocationService.kt`);
    const module = read(`${genRoot}/tracking/NativeTrackingModule.kt`);
    const app = read(`${genRoot}/MainApplication.kt`);

    expect(buildGradle).toContain("com.google.android.gms:play-services-location");
    expect(service).toContain("FusedLocationProviderClient");
    expect(service).toContain("insert or ignore into gps_pings");
    expect(module).toContain("startForegroundTracking");
    expect(module).toContain("stopForegroundTracking");
    expect(app).toContain("NativeTrackingPackage()");
  });

  test("uses a wake-up alarm to poll a fresh fix even with the screen off", () => {
    // A Handler/postDelayed timer is scheduled on CPU uptime, which freezes when
    // the CPU sleeps (screen off) — so pings only arrived while the screen was
    // on. A setExactAndAllowWhileIdle wake-up alarm fires during sleep/Doze and
    // re-arms itself via ACTION_POLL.
    const serviceTemplate = read("plugins/native-tracking/ForegroundLocationService.kt");

    expect(serviceTemplate).toContain("setExactAndAllowWhileIdle");
    expect(serviceTemplate).toContain("ELAPSED_REALTIME_WAKEUP");
    expect(serviceTemplate).toContain("ACTION_POLL");
    expect(serviceTemplate).toContain("scheduleNextPoll");
    // No uptime-based Handler timer (freezes in deep sleep).
    expect(serviceTemplate).not.toContain("postDelayed");
    // Active poll uses BALANCED (network) + a last-known fallback so an indoor
    // stationary phone still gets a fix (HIGH_ACCURACY returns null with no GPS).
    expect(serviceTemplate).toContain(
      "getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY",
    );
    expect(serviceTemplate).toContain("fusedLocationClient.lastLocation.addOnSuccessListener");
  });

  test("uploads queued pings itself so tracking is live while the app is backgrounded", () => {
    // The JS sync engine is suspended when the app is backgrounded/killed, so the
    // service must push pings to the server directly — otherwise points only
    // reach the dashboard when the SE next opens the app (hours later).
    const service = read("plugins/native-tracking/ForegroundLocationService.kt");
    const module = read("plugins/native-tracking/NativeTrackingModule.kt");
    // The JS native bridge lives in gps-native.ts after the logistics code-split.
    const gps = read("src/lib/gps-native.ts");

    // Off the main thread, one flush at a time.
    expect(service).toContain("uploadPendingPings");
    expect(service).toContain("Executors.newSingleThreadExecutor");
    // Same routing as the JS sync engine (session batch, with a visits fallback).
    expect(service).toContain("/tracking-sessions/");
    expect(service).toContain("points/batch");
    expect(service).toContain("/visits/gps/batch");
    // Authenticated POST, then mark the flushed rows synced.
    expect(service).toContain("HttpURLConnection");
    expect(service).toContain("Bearer ");
    expect(service).toContain("set synced = 1");

    // The token + base URL are bridged from JS (7-day TTL token, cleared on logout).
    expect(module).toContain("setUploadContext");
    expect(module).toContain("KEY_AUTH_TOKEN");
    expect(gps).toContain("setUploadContext");
  });
});
