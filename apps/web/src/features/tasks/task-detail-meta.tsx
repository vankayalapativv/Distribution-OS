import Link from "next/link";
import type { Task } from "./tasks-api";
import { PRIORITY_CLASSES, STATUS_CLASSES, STATUS_LABELS, formatDate, formatReminder, isOverdue } from "./tasks-shared";

/** The detail-drawer metadata: priority/status/due/assignee row, customer link,
 *  and the SE phone-reminder banner. */
export function TaskDetailMeta({ task }: { readonly task: Task }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${PRIORITY_CLASSES[task.priority] ?? ""}`}>{task.priority}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLASSES[task.status] ?? ""}`}>{STATUS_LABELS[task.status] ?? task.status}</span>
        <span className={isOverdue(task) ? "font-semibold text-red-600" : "text-muted-foreground"}>Due {formatDate(task.dueDate)}</span>
        <span className="text-muted-foreground">· {task.assignedToName ?? "Unassigned"}</span>
      </div>

      {task.customerId ? (
        <Link href={`/customers/${task.customerId}`} className="text-sm text-primary hover:underline">↗ {task.customerName}</Link>
      ) : null}

      {task.remindAt ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-600/20">
          📱 Phone reminder for {task.assignedToName ?? "the sales executive"} at{" "}
          <span className="font-semibold">{formatReminder(task.remindAt)}</span> (IST).
          {task.status === "done" && task.completedAt ? ` Marked done ${formatReminder(task.completedAt)}.` : ""}
        </div>
      ) : null}
    </>
  );
}
