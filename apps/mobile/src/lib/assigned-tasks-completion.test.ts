import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTestDb } from "../test/node-sqlite-db";
import { migrateLocalDb } from "./local-db";
import { NOW, cancelled, notificationsMock, scheduled, serverTask } from "./assigned-tasks.support";

vi.mock("expo-notifications", () => notificationsMock());

import { listAssignedTasks, markAssignedTaskDone, reconcileAssignedTasks } from "./assigned-tasks";

beforeEach(() => {
  scheduled.length = 0;
  cancelled.length = 0;
});
afterEach(() => vi.restoreAllMocks());

/** Stub the API so the online mark-done POST resolves. */
function stubDonePost(status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: status < 400, data: {} }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("assigned tasks (completion)", () => {
  test("a task the server marks done drops out of the list and its alarm is cancelled", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    await reconcileAssignedTasks(db, [serverTask({ status: "done" })], NOW);

    expect(listAssignedTasks(db)).toHaveLength(0);
    expect(cancelled).toContain("notif-1");
  });

  test("a task the server no longer returns is removed", async () => {
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    await reconcileAssignedTasks(db, [], NOW);

    expect(listAssignedTasks(db)).toHaveLength(0);
    expect(cancelled).toContain("notif-1");
  });

  test("marking done posts to the server, cancels the alarm, and hides the task", async () => {
    stubDonePost();
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    const [task] = listAssignedTasks(db);
    await markAssignedTaskDone(db, task, "tok");

    expect(listAssignedTasks(db)).toHaveLength(0);
    expect(cancelled).toContain("notif-1");
    const row = db.first<{ done_synced: number }>(
      "select done_synced from assigned_tasks where id = 'task-1'",
    );
    expect(row?.done_synced).toBe(1); // confirmed server-side
  });

  test("a 404 (already closed server-side) still marks it done locally", async () => {
    stubDonePost(404);
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    const [task] = listAssignedTasks(db);
    await markAssignedTaskDone(db, task, "tok");

    expect(listAssignedTasks(db)).toHaveLength(0);
  });

  test("a failed POST leaves the task open (throws, no local change)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const db = createTestDb();
    migrateLocalDb(db);

    await reconcileAssignedTasks(db, [serverTask()], NOW);
    const [task] = listAssignedTasks(db);
    await expect(markAssignedTaskDone(db, task, "tok")).rejects.toThrow();
    expect(listAssignedTasks(db)).toHaveLength(1); // still open
  });
});
