/**
 * Office-assigned tasks (2026-08-01).
 *
 * SUPER_ADMIN / MANAGER / ACCOUNTANT assign a task to a Sales Executive from
 * the web app; it surfaces in the SE's Reminders tab ("Assigned to you") and
 * rings on their phone at the set time. Unlike personal reminders (device is the
 * source of truth), these are SERVER-owned: pulled via GET /me/tasks and cached
 * here for offline display, with each open task mirrored to a scheduled OS
 * notification so it still rings without a connection.
 *
 * The SE can only mark one done — never delete it. Marking done is online-only:
 * the completion is POSTed to the server first, then mirrored locally.
 */
import { apiFetch, ApiRequestError } from "./api";
import { cancel } from "./assigned-tasks-notify";
import type { AssignedTask } from "./assigned-tasks-types";
import type { LocalDb } from "./local-db";

export type { AssignedTask, ServerAssignedTask } from "./assigned-tasks-types";
export { reconcileAssignedTasks } from "./assigned-tasks-reconcile";

function rowToTask(r: Record<string, unknown>): AssignedTask {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    priority: (r.priority as string) ?? "medium",
    customerId: (r.customer_id as string | null) ?? null,
    customerName: (r.customer_name as string | null) ?? null,
    remindAt: r.remind_at as number,
    createdByName: (r.created_by_name as string | null) ?? null,
    status: (r.status as string) ?? "open",
  };
}

/** Still-actionable assigned tasks (not done), soonest first — the section shown
 *  above personal reminders. */
export function listAssignedTasks(db: LocalDb): AssignedTask[] {
  return db
    .all<Record<string, unknown>>(
      `select id, title, description, priority, customer_id, customer_name,
              remind_at, created_by_name, status
         from assigned_tasks
        where status != 'done'
        order by remind_at asc`,
    )
    .map(rowToTask);
}

/** Count of open assigned tasks — feeds the Reminders tab badge alongside personal ones. */
export function openAssignedTaskCount(db: LocalDb): number {
  return (
    db.first<{ n: number }>(
      "select count(*) as n from assigned_tasks where status != 'done'",
    )?.n ?? 0
  );
}

/**
 * SE marks an assigned task done (online-required): POST the completion to the
 * server first — a 404 means it's already gone/closed, which also counts as done
 * — then cancel its alarm and mirror the row to done locally. A network failure
 * throws so the screen can show a retryable error and the task stays open.
 */
export async function markAssignedTaskDone(
  db: LocalDb,
  task: AssignedTask,
  token: string | null,
): Promise<void> {
  try {
    await apiFetch(`/me/tasks/${task.id}/done`, { method: "POST", token });
  } catch (e) {
    if (!(e instanceof ApiRequestError && e.status === 404)) throw e;
  }
  const row = db.first<{ notification_id: string | null }>(
    "select notification_id from assigned_tasks where id = ?",
    [task.id],
  );
  await cancel(row?.notification_id ?? null);
  db.run(
    "update assigned_tasks set status = 'done', notification_id = null, done_synced = 1 where id = ?",
    [task.id],
  );
}
