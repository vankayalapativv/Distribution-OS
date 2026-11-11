import * as Notifications from "expo-notifications";

import { type ReminderInput, scheduleReminderNotification } from "./reminders-notify";
import { type Reminder, rowToReminder } from "./reminders-row";
import type { LocalDb, SqlValue } from "./local-db";

export function getReminderById(db: LocalDb, id: number): Reminder | null {
  const row = db.first<Record<string, unknown>>(
    `select id, title, remind_at, customer_id, customer_name, notification_id, status, created_at
     from reminders where id = ?`,
    [id],
  );
  return row ? rowToReminder(row) : null;
}

export async function createReminder(
  db: LocalDb,
  input: ReminderInput,
  now: number,
): Promise<Reminder> {
  const notificationId = await scheduleReminderNotification(input);

  db.run(
    `insert into reminders (title, remind_at, customer_id, customer_name, notification_id, status, created_at)
     values (?, ?, ?, ?, ?, 'pending', ?)`,
    [
      input.title,
      input.remindAt.getTime(),
      input.customerId ?? null,
      input.customerName ?? null,
      notificationId,
      now,
    ] as SqlValue[],
  );
  const row = db.first<Record<string, unknown>>(
    "select * from reminders order by id desc limit 1",
  );
  return rowToReminder(row!);
}

/**
 * Edit a reminder: reschedule its OS alarm to the new time and update the row.
 * Re-arms it as pending (so editing an overdue/done one revives it).
 */
export async function updateReminder(
  db: LocalDb,
  reminder: Reminder,
  input: ReminderInput,
): Promise<Reminder> {
  if (reminder.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(
      () => undefined,
    );
  }
  const notificationId = await scheduleReminderNotification(input);
  db.run(
    `update reminders set
       title = ?, remind_at = ?, customer_id = ?, customer_name = ?,
       notification_id = ?, status = 'pending'
     where id = ?`,
    [
      input.title,
      input.remindAt.getTime(),
      input.customerId ?? null,
      input.customerName ?? null,
      notificationId,
      reminder.id,
    ] as SqlValue[],
  );
  return getReminderById(db, reminder.id)!;
}
