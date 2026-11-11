"use client";

import Link from "next/link";
import type { Task } from "./tasks-api";
import {
  PRIORITY_CLASSES,
  STATUS_CLASSES,
  STATUS_LABELS,
  formatDate,
  isOverdue,
} from "./tasks-shared";

interface TasksTableProps {
  readonly tasks: Task[];
  readonly onOpen: (task: Task) => void;
}

export function TasksTable({ tasks, onOpen }: TasksTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      {tasks.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-muted-foreground">
          No tasks here. Create one with “New task”.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onOpen(task)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{task.title}</p>
                  {task.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_CLASSES[task.priority] ?? ""}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[task.status] ?? ""}`}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td className={`px-4 py-3 text-xs ${isOverdue(task) ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                  {formatDate(task.dueDate)}
                  {isOverdue(task) ? " · overdue" : ""}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {task.assignedToName ?? "Unassigned"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {task.customerId ? (
                    <Link
                      href={`/customers/${task.customerId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline"
                    >
                      {task.customerName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
