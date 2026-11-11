import type { ActionConfig } from "@/lib/api-client";
import type { Task } from "./tasks-api";

/** actionConfig for the tasks feature — adds the current user id used by the "My tasks" filter. */
export interface TasksActionConfig extends ActionConfig {
  currentUserId: string;
}

export const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

export type StatusTabKey = (typeof STATUS_TABS)[number]["key"];

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_CLASSES: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
  medium: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20",
  low: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
};

export const STATUS_CLASSES: Record<string, string> = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
  done: "bg-green-50 text-green-700 ring-1 ring-green-600/20",
  cancelled: "bg-slate-100 text-slate-500 line-through",
};

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Kolkata", // single-client IST; correct even if SSR'd (UTC)
    });
  } catch {
    return dateStr;
  }
}

/** Full date + time of an SE phone reminder, shown in IST. */
export function formatReminder(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso;
  }
}

export function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === "done" || task.status === "cancelled") return false;
  // Anchor the end-of-day boundary to IST (+05:30) so it's an absolute instant.
  // Without an explicit zone the string parses in the runtime's local zone — UTC
  // on the server, IST in the browser — causing a hydration mismatch and a
  // ~5.5h-lenient boundary for tasks rendered around IST midnight.
  return new Date(task.dueDate + "T23:59:59+05:30") < new Date();
}
