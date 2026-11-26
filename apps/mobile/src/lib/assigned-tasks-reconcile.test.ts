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

  test("defaults a missing priority to medium", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    await reconcileAssignedTasks(db, [serverTask({ priority: undefined })], NOW);
    expect(db.first<{ priority: string }>("select priority from assigned_tasks where id = 'task-1'")?.priority).toBe("medium");
  });

  test("skips a server task that has no reminder time", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    await reconcileAssignedTasks(db, [serverTask({ remindAt: null })], NOW);
    expect(listAssignedTasks(db)).toHaveLength(0);
  });

  test("schedules an alarm for an in-progress task", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    await reconcileAssignedTasks(db, [serverTask({ status: "in_progress" })], NOW);
    expect(scheduled).toHaveLength(1);
  });

  test("drops a task that has disappeared from the server (cancelling its alarm)", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    await reconcileAssignedTasks(db, [serverTask()], NOW);
    await reconcileAssignedTasks(db, [], NOW); // task-1 gone from the server
    expect(listAssignedTasks(db)).toHaveLength(0);
    expect(cancelled).toContain("notif-1");
  });

  test("does not revive a task that was marked done offline (done_synced = 0)", async () => {
    const db = createTestDb();
    migrateLocalDb(db);
    await reconcileAssignedTasks(db, [serverTask()], NOW);
    db.run("update assigned_tasks set status = 'done', done_synced = 0 where id = 'task-1'");
    await reconcileAssignedTasks(db, [serverTask()], NOW); // server still says open
    expect(db.first<{ status: string }>("select status from assigned_tasks where id = 'task-1'")?.status).toBe("done");
  });
});
