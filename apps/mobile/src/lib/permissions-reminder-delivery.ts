import {
  canScheduleExactAlarms,
  isIgnoringBatteryOptimizations,
  openExactAlarmSettings,
  requestIgnoreBatteryOptimizations,
} from "./permissions-native";
import type { ConfirmFn } from "./permissions";

/**
 * Ensure a personal reminder will actually ring ON TIME. Two Android settings
 * decide this, and both are system screens (not runtime dialogs), so we guide
 * the SE to them. Each auto-skips when already granted — a set-up SE sees no
 * prompts.
 *  - exact-alarm capability: without it, expo-notifications falls back to an
 *    INEXACT alarm that Doze can defer by minutes to hours.
 *  - battery-optimization exemption: OEM battery managers otherwise delay or
 *    drop background alarms while the phone sleeps.
 * Non-blocking: the reminder is still scheduled either way (best it can be).
 */
export async function ensureReminderDelivery(confirm: ConfirmFn): Promise<void> {
  if (!(await canScheduleExactAlarms())) {
    const proceed = await confirm({
      title: "Let reminders ring on time",
      message:
        'Sri Aparajitha needs the "Alarms & reminders" permission so your reminder fires at the exact time. Turn it on for Sri Aparajitha on the next screen.',
      confirmLabel: "Open settings",
      cancelLabel: "Skip",
    });
    if (proceed) await openExactAlarmSettings();
  }
  if (!(await isIgnoringBatteryOptimizations())) {
    const proceed = await confirm({
      title: "Keep reminders reliable",
      message:
        "So reminders aren't delayed when your phone sleeps, allow Sri Aparajitha to run without battery limits. Tap \"Allow\" on the next screen.",
      confirmLabel: "Continue",
      cancelLabel: "Not now",
    });
    if (proceed) await requestIgnoreBatteryOptimizations();
  }
}
