import { cancel, scheduleTaskNotification } from "./assigned-tasks-notify";
import type { LocalRow, ServerAssignedTask } from "./assigned-tasks-types";
import type { LocalDb, SqlValue } from "./local-db";

/**
 * Merge the server's assigned-task list into the local cache, keeping the OS
 * notifications in sync:
 *  - a still-open task with a future time gets (or keeps) a scheduled alarm;
 *  - a done/cancelled/past task has its alarm cancelled;
 *  - a task the server no longer returns is removed (its alarm cancelled) —
 *    unless it has an unsynced local "done" waiting to upload.
 */
const isTaskActive = (status: string, remindAt: number, now: number): boolean =>
  (status === "open" || status === "in_progress") && remindAt > now;

/** Cancel/(re)schedule the OS alarm for one task, returning the notification id
 *  to persist (null when the task shouldn't have an alarm). */
async function resolveNotificationId(
  prev: LocalRow | undefined,
  t: ServerAssignedTask,
  remindAt: number,
  isActive: boolean,
  now: number,
): Promise<string | null> {
  const prevId = prev?.notification_id ?? null;
  if (!isActive) {
    await cancel(prevId);
    return null;
  }
  const wasActive = prev ? isTaskActive(prev.status, prev.remind_at, now) : false;
  if (prevId && prev?.remind_at === remindAt && wasActive) return prevId; // alarm still valid
  await cancel(prevId);
  return scheduleTaskNotification({
    title: t.title,
    customerName: t.customerName,
    remindAt,
    customerId: t.customerId,
    id: t.id,
  });
}

/** Insert or update one assigned-task row (marks it server-synced). */
function upsertAssignedTask(db: LocalDb, t: ServerAssignedTask, remindAt: number, notificationId: string | null, now: number): void {
  db.run(
    `insert into assigned_tasks
       (id, title, description, priority, customer_id, customer_name, remind_at,
        created_by_name, status, notification_id, done_synced, updated_at, cached_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     on conflict(id) do update set
       title = excluded.title,
       description = excluded.description,
       priority = excluded.priority,
       customer_id = excluded.customer_id,
       customer_name = excluded.customer_name,
       remind_at = excluded.remind_at,
       created_by_name = excluded.created_by_name,
       status = excluded.status,
       notification_id = excluded.notification_id,
       done_synced = 1,
       updated_at = excluded.updated_at,
       cached_at = excluded.cached_at`,
    [
      t.id,
      t.title,
      t.description,
      t.priority ?? "medium",
      t.customerId,
      t.customerName,
      remindAt,
      t.createdByName,
      t.status,
      notificationId,
      t.updatedAt,
      now,
    ] as SqlValue[],
  );
}

/** Drop rows the server dropped (reassigned / long-done), leaving any pending
 *  offline "done" in place so its queue item can still fire. */
async function dropRemovedTasks(db: LocalDb, existing: LocalRow[], serverIds: Set<string>): Promise<void> {
  for (const row of existing) {
    if (!serverIds.has(row.id) && row.done_synced === 1) {
      await cancel(row.notification_id);
      db.run("delete from assigned_tasks where id = ?", [row.id]);
    }
  }
}

export async function reconcileAssignedTasks(
  db: LocalDb,
  serverTasks: ServerAssignedTask[],
  now: number,
): Promise<void> {
  const existing = db.all<LocalRow>(
    "select id, remind_at, status, notification_id, done_synced from assigned_tasks",
  );
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const serverIds = new Set(serverTasks.filter((t) => t.remindAt).map((t) => t.id));

  await dropRemovedTasks(db, existing, serverIds);

  for (const t of serverTasks) {
    if (!t.remindAt) continue; // not an SE reminder task
    const prev = existingById.get(t.id);
    // A done recorded offline is being uploaded — don't let the pull revive it.
    if (prev && prev.done_synced === 0) continue;

    const remindAt = new Date(t.remindAt).getTime();
    const notificationId = await resolveNotificationId(prev, t, remindAt, isTaskActive(t.status, remindAt, now), now);
    upsertAssignedTask(db, t, remindAt, notificationId, now);
  }
}
