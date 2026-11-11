import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";
import { cancelled, notificationsMock, scheduled } from "./reminders.support";

vi.mock("expo-notifications", () => notificationsMock());

import {
  createReminder,
  deleteReminder,
  getReminderById,
  listReminders,
  markReminderDone,
  pendingReminderCount,
  updateReminder,
} from "./reminders";

beforeEach(() => {
  scheduled.length = 0;
  cancelled.length = 0;
});

describe("reminders (mutations)", () => {
  test("markReminderDone moves it to done and cancels its alarm", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const r = await createReminder(db, { title: "close me", remindAt: new Date(Date.now() - 1000) }, 1);
    await markReminderDone(db, r);
    expect(getReminderById(db, r.id)?.status).toBe("done");
    expect(cancelled).toEqual([r.notificationId]);
    expect(pendingReminderCount(db)).toBe(0);
  });

  test("updateReminder reschedules the alarm and updates fields", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const r = await createReminder(db, { title: "before", remindAt: new Date(Date.now() + 1000) }, 1);
    const newWhen = new Date(Date.now() + 7_200_000);
    const updated = await updateReminder(db, r, { title: "after", remindAt: newWhen, customerId: "c9", customerName: "Acme" });

    expect(cancelled).toEqual([r.notificationId]); // old alarm cancelled
    expect(scheduled).toHaveLength(2); // new alarm scheduled
    expect(updated.title).toBe("after");
    expect(updated.remindAt).toBe(newWhen.getTime());
    expect(updated.customerName).toBe("Acme");
    expect(updated.notificationId).toBe("notif-2");
    expect(updated.status).toBe("pending");
  });

  test("deleting a pending reminder cancels its notification", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const r1 = await createReminder(db, { title: "a", remindAt: new Date(Date.now() + 1000_000) }, 1);
    await deleteReminder(db, r1);
    expect(cancelled).toEqual([r1.notificationId]);
    expect(listReminders(db)).toHaveLength(0);
  });
});
