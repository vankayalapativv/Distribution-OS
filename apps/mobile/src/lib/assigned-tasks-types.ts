/** Server row shape from GET /me/tasks. */
export interface ServerAssignedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  remindAt: string | null; // ISO instant
  customerId: string | null;
  customerName: string | null;
  createdByName: string | null;
  updatedAt: string;
}

export interface AssignedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  customerId: string | null;
  customerName: string | null;
  remindAt: number; // epoch ms
  createdByName: string | null;
  status: "open" | "in_progress" | "done" | string;
}

/** Local cache row (assigned_tasks table) read during reconcile. */
export interface LocalRow {
  id: string;
  remind_at: number;
  status: string;
  notification_id: string | null;
  done_synced: number;
}
