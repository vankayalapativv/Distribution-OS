import { describe, expect, test } from "vitest";
import { freshDb, NOW } from "./sync-core.test-support";
import {
  backoffDelayMs,
  enqueue,
  enqueueAssignedTaskDone,
  isPermanentFailure,
  SyncHttpError,
} from "./sync-core-types";

describe("backoffDelayMs", () => {
  test("doubles from a 5s base and caps at 5 minutes", () => {
    expect(backoffDelayMs(0)).toBe(5_000);
    expect(backoffDelayMs(1)).toBe(10_000);
    expect(backoffDelayMs(5)).toBe(160_000);
    expect(backoffDelayMs(10)).toBe(300_000); // capped
  });
});

describe("isPermanentFailure", () => {
  test("non-HTTP errors are retryable", () => {
    expect(isPermanentFailure(new Error("network"))).toBe(false);
  });
  test("401 / 408 / 429 are retryable", () => {
    for (const s of [401, 408, 429]) expect(isPermanentFailure(new SyncHttpError(s, "x"))).toBe(false);
  });
  test("other 4xx are permanent; 5xx are retryable", () => {
    expect(isPermanentFailure(new SyncHttpError(400, "bad"))).toBe(true);
    expect(isPermanentFailure(new SyncHttpError(404, "missing"))).toBe(true);
    expect(isPermanentFailure(new SyncHttpError(500, "server"))).toBe(false);
  });
});

describe("enqueue", () => {
  test("writes a pending sync_queue row", () => {
    const db = freshDb();
    enqueue(db, "order", "uuid-1", { foo: 1 }, NOW);
    const row = db.first<{ entity_type: string; status: string; attempts: number; next_attempt_at: number; payload: string }>(
      "select entity_type, status, attempts, next_attempt_at, payload from sync_queue where client_uuid = 'uuid-1'",
    );
    expect(row).toMatchObject({ entity_type: "order", status: "pending", attempts: 0, next_attempt_at: 0 });
    expect(JSON.parse(row!.payload)).toEqual({ foo: 1 });
  });
});

describe("enqueueAssignedTaskDone", () => {
  test("queues a task_done with the task id as payload", () => {
    const db = freshDb();
    enqueueAssignedTaskDone(db, "task-9", NOW);
    const row = db.first<{ entity_type: string; client_uuid: string; payload: string }>(
      "select entity_type, client_uuid, payload from sync_queue where client_uuid = 'task-9'",
    );
    expect(row).toMatchObject({ entity_type: "task_done", client_uuid: "task-9" });
    expect(JSON.parse(row!.payload)).toEqual({ taskId: "task-9" });
  });
});
