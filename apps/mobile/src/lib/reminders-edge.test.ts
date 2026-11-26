import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";

const cancel = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const schedule = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("notif-x"));
vi.mock("expo-notifications", () => ({
  cancelScheduledNotificationAsync: (...a: unknown[]) => cancel(...a),
  scheduleNotificationAsync: (...a: unknown[]) => schedule(...a),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

import { createReminder, deleteReminder, listReminders, markReminderDone, pendingReminderCount } from "./reminders";
import { getReminderById, updateReminder } from "./reminders-write";
import type { Reminder } from "./reminders-row";
import type { LocalDb } from "./local-db";

function freshDb() {
  const db = createTestDb();
  migrateLocalDb(db);
  return db;
}
const base = (over: Partial<Reminder>): Reminder => ({
  id: 1, title: "t", remindAt: Date.now(), customerId: null, customerName: null,
  notificationId: "notif-x", status: "pending", createdAt: 1, ...over,
});

beforeEach(() => { cancel.mockResolvedValue(undefined); schedule.mockResolvedValue("notif-x"); });
afterEach(() => vi.clearAllMocks());

describe("deleteReminder guards + catch", () => {
  test("skips the cancel for a non-pending reminder", async () => {
    const db = freshDb();
    await deleteReminder(db, base({ status: "done" }));
    expect(cancel).not.toHaveBeenCalled();
  });
  test("skips the cancel when there's no notification id", async () => {
    const db = freshDb();
    await deleteReminder(db, base({ notificationId: null }));
    expect(cancel).not.toHaveBeenCalled();
  });
  test("still deletes the row when the alarm cancel rejects", async () => {
    const db = freshDb();
    const r = await createReminder(db, { title: "a", remindAt: new Date(Date.now() + 1000) }, 1);
    cancel.mockRejectedValueOnce(new Error("no such alarm"));
    await deleteReminder(db, r);
    expect(listReminders(db)).toHaveLength(0);
  });
});

describe("markReminderDone guard + catch", () => {
  test("marks done without a cancel when there's no notification id", async () => {
    const db = freshDb();
    const r = await createReminder(db, { title: "a", remindAt: new Date(Date.now() + 1000) }, 1);
    cancel.mockClear();
    await markReminderDone(db, { ...r, notificationId: null });
    expect(cancel).not.toHaveBeenCalled();
    expect(getReminderById(db, r.id)?.status).toBe("done");
  });
  test("marks done even when the alarm cancel rejects", async () => {
    const db = freshDb();
    const r = await createReminder(db, { title: "a", remindAt: new Date(Date.now() + 1000) }, 1);
    cancel.mockRejectedValueOnce(new Error("gone"));
    await markReminderDone(db, r);
    expect(getReminderById(db, r.id)?.status).toBe("done");
  });
});

describe("updateReminder + getReminderById edges", () => {
  test("updates even when cancelling the old alarm rejects", async () => {
    const db = freshDb();
    const r = await createReminder(db, { title: "before", remindAt: new Date(Date.now() + 1000) }, 1);
    cancel.mockRejectedValueOnce(new Error("gone"));
    schedule.mockResolvedValueOnce("notif-2");
    const updated = await updateReminder(db, r, { title: "after", remindAt: new Date(Date.now() + 5000) });
    expect(updated.title).toBe("after");
    expect(updated.notificationId).toBe("notif-2");
  });
  test("reschedules a reminder that had no prior alarm (no cancel)", async () => {
    const db = freshDb();
    const r = await createReminder(db, { title: "before", remindAt: new Date(Date.now() + 1000) }, 1);
    cancel.mockClear();
    schedule.mockResolvedValueOnce("notif-3");
    const updated = await updateReminder(db, { ...r, notificationId: null }, { title: "after", remindAt: new Date(Date.now() + 5000) });
    expect(cancel).not.toHaveBeenCalled();
    expect(updated.notificationId).toBe("notif-3");
  });
  test("returns null for an unknown id", () => {
    expect(getReminderById(freshDb(), 9999)).toBeNull();
  });
});

describe("pendingReminderCount", () => {
  test("defaults to 0 when the count query yields no row", () => {
    expect(pendingReminderCount({ first: () => undefined } as unknown as LocalDb)).toBe(0);
  });
});
