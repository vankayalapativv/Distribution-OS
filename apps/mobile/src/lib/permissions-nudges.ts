import { maybePromptAutostart } from "./permissions-autostart";
import { canScheduleExactAlarms, openExactAlarmSettings } from "./permissions-native";
import type { ConfirmFn } from "./permissions";

/**
 * Tail of the Start-day setup: the two non-blocking nudges that run once every
 * essential is satisfied. Neither blocks the day — the service is already
 * cleared to start — so we prompt and move on.
 *  - exact alarm (Android 12+): powers the wake-up poll.
 *  - OEM autostart / protected-apps: one-time nudge on aggressive vendors
 *    (vivo/OnePlus/Xiaomi/Oppo/realme/Huawei) whose battery managers kill the
 *    service even with battery optimization disabled.
 */
export async function runStartDayNudges(confirm: ConfirmFn): Promise<void> {
  if (!(await canScheduleExactAlarms())) {
    const proceed = await confirm({
      title: "Allow scheduled tracking",
      message:
        'Distribution OS needs the "Alarms & reminders" permission to record your location on time. Turn it on for Distribution OS on the next screen.',
      confirmLabel: "Open settings",
      cancelLabel: "Skip",
    });
    if (proceed) await openExactAlarmSettings();
  }
  await maybePromptAutostart(confirm);
}
