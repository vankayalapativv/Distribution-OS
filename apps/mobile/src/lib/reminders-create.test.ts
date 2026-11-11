import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";
import { cancelled, notificationsMock, scheduled } from "./reminders.support";

vi.mock("expo-notifications", () => notificationsMock());

import { createReminder, listReminders, pendingReminderCount } from "./reminders";

beforeEach(() => {
  scheduled.length = 0;
  cancelled.length = 0;
});

describe("reminders (create)", () => {
  test("createReminder schedules a notification and stores the row", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const when = new Date(Date.now() + 3_600_000);
    const r = await createReminder(
      db,
      { title: "Collect from Siddu Auto", remindAt: when, customerId: "c1", customerName: "Siddu Auto" },
      1000,
    );
    expect(r.title).toBe("Collect from Siddu Auto");
    expect(r.remindAt).toBe(when.getTime());
    expect(r.customerId).toBe("c1");
    expect(r.notificationId).toBe("notif-1");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].date.getTime()).toBe(when.getTime());
  });

  test("reminders never auto-close; an elapsed one stays pending (shown as Overdue)", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3_600_000);
    await createReminder(db, { title: "old", remindAt: past }, 1);
    await createReminder(db, { title: "new", remindAt: future }, 2);

    // No settle step — both remain pending until the SE closes them.
    const all = listReminders(db);
    expect(all.find((r) => r.title === "old")?.status).toBe("pending");
    expect(all.find((r) => r.title === "new")?.status).toBe("pending");
    expect(pendingReminderCount(db)).toBe(2);
  });
});
