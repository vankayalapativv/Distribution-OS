/**
 * Office-assigned tasks: pull them into the local cache + OS alarms, both on the
 * regular sync cadence and on-demand when the Reminders tab focuses.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { reconcileAssignedTasks, type ServerAssignedTask } from "./assigned-tasks";
import type { LocalDb } from "./local-db";

/** Pull office-assigned tasks and reconcile them into the local cache + OS
 *  alarms. Best-effort — offline leaves the existing cache untouched. */
export async function pullAssignedTasks(db: LocalDb, token: string | null, now: number): Promise<void> {
  try {
    const data = await apiFetch<{ tasks: ServerAssignedTask[] }>("/me/tasks", { token });
    if (Array.isArray(data?.tasks)) {
      await reconcileAssignedTasks(db, data.tasks, now);
    }
  } catch {
    // offline / SE-only endpoint unavailable — keep whatever is cached
  }
}

/** Force an assigned-tasks refresh now (called when the Reminders tab focuses),
 *  independent of the full sync cadence. Resolves after reconcile so the caller
 *  can re-read the local cache. */
export async function refreshAssignedTasksNow(): Promise<void> {
  const db = getLocalDb();
  if (!db) return;
  const token = useAuth.getState().token;
  if (!token) return;
  await pullAssignedTasks(db, token, Date.now());
}
