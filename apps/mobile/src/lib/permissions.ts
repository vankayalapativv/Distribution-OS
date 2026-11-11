import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations } from "./permissions-native";
import { runStartDayNudges } from "./permissions-nudges";
import type { StartDayPermissionResult } from "./permissions-types";
import type { ConfirmOptions } from "../components/dialog";

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

// Result types, reminder delivery, and the autostart nudge live in split modules.
export type { MissingEssential, StartDayPermissionResult } from "./permissions-types";
export { ensureReminderDelivery } from "./permissions-reminder-delivery";
export { maybePromptAutostart } from "./permissions-autostart";
export { openAutostartSettings } from "./permissions-native";

/**
 * Guided, step-by-step permission setup run when the SE taps "Start day".
 * Order: location → notifications → camera → background location → battery →
 * exact alarm. Each step auto-skips if already granted, so returning users pass
 * straight through. Essentials (foreground location, battery-optimization
 * exemption) block the start; everything else is prompted but non-blocking.
 */
// Each step returns a blocking result (an essential is missing) or null to pass.

/** 1. Foreground location — ESSENTIAL. In-app runtime dialog. */
async function ensureForegroundLocation(confirm: ConfirmFn): Promise<StartDayPermissionResult | null> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted && foreground.canAskAgain) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (foreground.granted) return null;
  const openSettings = await confirm({
    title: "Location is required",
    message:
      "Distribution OS records the area you cover during your day. Please allow location access to start your day.",
    confirmLabel: "Open settings",
    cancelLabel: "Not now",
  });
  if (openSettings) void Linking.openSettings();
  return { ok: false, missingEssential: "location" };
}

/** 2–3. Notifications + camera — prompt once, non-blocking. */
async function promptOptionalPermissions(): Promise<void> {
  const notifications = await Notifications.getPermissionsAsync();
  if (!notifications.granted && notifications.canAskAgain) {
    await Notifications.requestPermissionsAsync().catch(() => undefined);
  }
  const camera = await ImagePicker.getCameraPermissionsAsync();
  if (!camera.granted && camera.canAskAgain) {
    await ImagePicker.requestCameraPermissionsAsync().catch(() => undefined);
  }
}

/** 4. Background "Allow all the time" — ESSENTIAL (2026-08-01). Without it the OS
 *  only delivers fixes while foregrounded, so coverage collapses (one SE sat at
 *  ~40% purely because this was denied). Block the day until it's granted. */
async function ensureBackgroundLocation(confirm: ConfirmFn): Promise<StartDayPermissionResult | null> {
  let background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (background?.granted) return null;
  const proceed = await confirm({
    title: "Allow location all the time",
    message:
      'Your route must keep recording when the app is in your pocket. On the next screen choose "Allow all the time", then tap "Start day" again.',
    confirmLabel: "Continue",
    cancelLabel: "Not now",
  });
  if (proceed) {
    if (background?.canAskAgain === false) {
      void Linking.openSettings();
    } else {
      await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
    }
    background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  }
  if (background?.granted) return null;
  return { ok: false, missingEssential: "background", awaitingSystemScreen: proceed };
}

/** 5. Battery-optimization exemption — ESSENTIAL. System dialog (async), so if it
 *  isn't granted we launch it and ask the SE to retry Start day. */
async function ensureBatteryExemption(confirm: ConfirmFn): Promise<StartDayPermissionResult | null> {
  if (await isIgnoringBatteryOptimizations()) return null;
  const proceed = await confirm({
    title: "Allow Distribution OS to run all day",
    message:
      'To record your route reliably even with the screen off, Distribution OS must run without battery limits. Tap "Allow" on the next screen, then tap "Start day" again.',
    confirmLabel: "Continue",
    cancelLabel: "Not now",
  });
  if (proceed) await requestIgnoreBatteryOptimizations();
  return { ok: false, missingEssential: "battery", awaitingSystemScreen: proceed };
}

export async function runStartDayPermissionSetup(
  confirm: ConfirmFn,
): Promise<StartDayPermissionResult> {
  const foreground = await ensureForegroundLocation(confirm);
  if (foreground) return foreground;

  await promptOptionalPermissions();

  const background = await ensureBackgroundLocation(confirm);
  if (background) return background;

  const battery = await ensureBatteryExemption(confirm);
  if (battery) return battery;

  // 6–7. Exact alarm + OEM autostart — guided, non-blocking.
  await runStartDayNudges(confirm);
  return { ok: true };
}
