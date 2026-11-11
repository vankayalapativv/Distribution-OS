import { describe, expect, test } from "vitest";
import { read } from "./android-native-tracking.support";

describe("Android native tracking service (hardening + Start Day)", () => {
  test("hardens capture on aggressive OEMs (autostart deep-link + WorkManager watchdog)", () => {
    const module = read("plugins/native-tracking/NativeTrackingModule.kt");
    const service = read("plugins/native-tracking/ForegroundLocationService.kt");
    const worker = read("plugins/native-tracking/TrackingWatchdogWorker.kt");
    const plugin = read("plugins/withNativeTracking.js");
    const permissions = read("src/lib/permissions.ts");

    // 1. Native autostart deep-link with per-OEM components + app-details fallback.
    expect(module).toContain("openAutostartSettings");
    expect(module).toContain("com.miui.permcenter.autostart.AutoStartManagementActivity"); // Xiaomi
    expect(module).toContain("com.vivo.permissionmanager.activity.BgStartUpManagerActivity"); // vivo
    expect(module).toContain("com.coloros.safecenter.permission.startup.StartupAppListActivity"); // Oppo/Realme
    expect(module).toContain("ACTION_APPLICATION_DETAILS_SETTINGS"); // fallback
    // JS side prompts it once per install on aggressive vendors.
    expect(permissions).toContain("maybePromptAutostart");
    expect(permissions).toContain("openAutostartSettings");

    // 2. WorkManager periodic backstop that restarts the service while backgrounded.
    expect(worker).toContain("Worker(context, params)");
    expect(worker).toContain("doWork");
    expect(worker).toContain("ACTION_BOOT_RECOVERY"); // reuses the "ensure running" path
    expect(worker).toContain("KEY_ACTIVE");
    expect(service).toContain("PeriodicWorkRequestBuilder<TrackingWatchdogWorker>");
    expect(service).toContain("enqueueWatchdog");
    expect(service).toContain("cancelWatchdog");
    expect(service).toContain("ExistingPeriodicWorkPolicy.KEEP");
    // Plugin ships the worker + the WorkManager dependency.
    expect(plugin).toContain("TrackingWatchdogWorker.kt");
    expect(plugin).toContain("androidx.work:work-runtime");
  });

  test("is started and stopped by the existing Start Day flow", () => {
    // The native-tracking bridge moved to gps-native.ts in the logistics code-split.
    const gps = read("src/lib/gps-native.ts");

    expect(gps).toContain("NativeModules");
    expect(gps).toContain("startForegroundTracking");
    expect(gps).toContain("stopForegroundTracking");
  });

  test("exposes native launchers for the battery + exact-alarm system screens", () => {
    // These two permissions have no runtime dialog — only a system screen — so
    // the Start Day guided flow drives them through the native module.
    const moduleTemplate = read("plugins/native-tracking/NativeTrackingModule.kt");
    const appConfig = read("app.json");

    for (const method of [
      "isIgnoringBatteryOptimizations",
      "requestIgnoreBatteryOptimizations",
      "canScheduleExactAlarms",
      "openExactAlarmSettings",
    ]) {
      expect(moduleTemplate).toContain(method);
    }
    expect(moduleTemplate).toContain("ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
    expect(moduleTemplate).toContain("ACTION_REQUEST_SCHEDULE_EXACT_ALARM");
    expect(appConfig).toContain("REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
  });

  test("Start Day runs the guided permission setup", () => {
    const startScreen = read("src/app/(tabs)/index.tsx");
    // The SE Start-day handler was extracted into this hook; the screen consumes
    // it via useDayTracking and the hook runs the wizard.
    const startDayHook = read("src/lib/use-day-tracking.ts");
    const startDayFlow = read("src/lib/start-day-flow.ts");
    // The delivery-run start handler was extracted into this hook during the
    // logistics code-split; it still runs the wizard directly.
    const deliveryStartHook = read("src/lib/use-delivery-run-form.ts");
    const permissions = read("src/lib/permissions.ts");

    // The SE Start-day delegates to the shared runStartDayFlow helper (which runs
    // the wizard) via useDayTracking; the logistics delivery-run runs it directly.
    expect(startScreen).toContain("useDayTracking");
    expect(startDayHook).toContain("runStartDayFlow");
    expect(startDayFlow).toContain("runStartDayPermissionSetup");
    expect(deliveryStartHook).toContain("runStartDayPermissionSetup");
    // Essentials block the start; the others are prompted.
    expect(permissions).toContain('missingEssential: "location"');
    expect(permissions).toContain('missingEssential: "battery"');
    expect(permissions).toContain("requestBackgroundPermissionsAsync");
    expect(permissions).toContain("requestCameraPermissionsAsync");
    expect(permissions).toContain("Notifications.requestPermissionsAsync");
  });
});
