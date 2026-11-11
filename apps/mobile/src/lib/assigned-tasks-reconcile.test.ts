import { beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";
import { NOW, cancelled, notificationsMock, scheduled, serverTask } from "./assigned-tasks.support";

vi.mock("expo-notifications", () => notificationsMock());

import { listAssignedTasks, openAssignedTaskCount, reconcileAssignedTasks } from "./assigned-tasks";

beforeEach(() => {
  scheduled.length = 0;
  cancelled.length = 0;
});

describe("assigned tasks (reconcile)", () => {
  test("reconcile caches a future task and schedules its alarm", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);

    const tasks = listAssignedTasks(db);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Call RK Automobiles");
    expect(tasks[0].customerName).toBe("RK Automobiles");
    expect(scheduled).toHaveLength(1);
    expect(openAssignedTaskCount(db)).toBe(1);
  });

  test("a past-due task is cached but gets no alarm (can't schedule in the past)", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(
      db,
      [serverTask({ remindAt: new Date(NOW - 3_600_000).toISOString() })],
      NOW,
    );

    expect(listAssignedTasks(db)).toHaveLength(1);
    expect(scheduled).toHaveLength(0);
  });

  test("re-reconcile with the same task does not reschedule", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    await reconcileAssignedTasks(db, [serverTask()], NOW);

    expect(scheduled).toHaveLength(1); // still just the first schedule
  });

  test("changing the reminder time cancels the old alarm and schedules a new one", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    await reconcileAssignedTasks(
      db,
      [serverTask({ remindAt: new Date(NOW + 7_200_000).toISOString() })],
      NOW,
    );

    expect(scheduled).toHaveLength(2);
    expect(cancelled).toContain("notif-1");
  });
});
