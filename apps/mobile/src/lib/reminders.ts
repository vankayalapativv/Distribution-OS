/**
 * Personal reminders (Alerts & Reminders, 2026-07-17).
 *
 * Local-only by design: the reminder text + time live in SQLite and the
 * actual "ring at the exact time" is a scheduled OS notification
 * (expo-notifications) — works with the app closed and without internet,
 * like an alarm clock. If the phone is off at ring time, Android delivers
 * the notification on next boot.
 */
import * as Notifications from "expo-notifications";
import { type Reminder, rowToReminder } from "./reminders-row";
import type { LocalDb } from "./local-db";

export type { Reminder } from "./reminders-row";
export { installNotificationHandler, ensureNotificationPermission } from "./reminders-notify";
export { createReminder, getReminderById, updateReminder } from "./reminders-write";

export function listReminders(db: LocalDb): Reminder[] {
  return db
    .all<Record<string, unknown>>(
      `select id, title, remind_at, customer_id, customer_name, notification_id, status, created_at
       from reminders order by status asc, remind_at asc`,
    )
    .map(rowToReminder);
}

/** Delete a reminder and cancel its pending notification. */
export async function deleteReminder(db: LocalDb, reminder: Reminder): Promise<void> {
  if (reminder.status === "pending" && reminder.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(
      () => undefined,
    );
  }
  db.run("delete from reminders where id = ?", [reminder.id]);
}

/**
 * Manually mark a reminder done (moves it to the Done list). Reminders NEVER
 * auto-complete — only the SE closes them — so an elapsed reminder stays
 * pending (shown as "Overdue") until this is called. Cancels the OS alarm so a
 * not-yet-fired reminder won't ring after being closed.
 */
export async function markReminderDone(db: LocalDb, reminder: Reminder): Promise<void> {
  if (reminder.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(
      () => undefined,
    );
  }
  db.run("update reminders set status = 'done' where id = ?", [reminder.id]);
}

/** Count of still-open reminders (pending = not manually closed). */
export function pendingReminderCount(db: LocalDb): number {
  return (
    db.first<{ n: number }>("select count(*) as n from reminders where status = 'pending'")?.n ?? 0
  );
}
