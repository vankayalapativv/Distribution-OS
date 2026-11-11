"use client";

import { Plus, X } from "lucide-react";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import type { CustomerLite, Task, TaskAssignee } from "./tasks-api";
import type { TasksActionConfig } from "./tasks-shared";
import { TasksFilters } from "./tasks-filters";
import { TasksTable } from "./tasks-table";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { useTasksList } from "./use-tasks-list";

export type TasksRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

interface TasksListProps {
  readonly tasks: Task[];
  readonly assignees: TaskAssignee[];
  readonly customers: CustomerLite[];
  readonly role: TasksRole;
  readonly actionConfig: TasksActionConfig;
}

export function TasksList({ tasks, assignees, customers, role, actionConfig }: TasksListProps) {
  const t = useTasksList(tasks, actionConfig);

  return (
    <>
      <DashboardShell role={role} active="tasks">
        <PageHeader
          title="Tasks"
          subtitle={
            <>
              Your to-dos — tasks you created or that are assigned to you
              {t.openCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
                  {t.openCount} active
                </span>
              )}
            </>
          }
          action={
            <button
              onClick={() => t.setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus size={15} /> New task
            </button>
          }
        />

        {t.error ? (
          <div className="flex items-center justify-between rounded-md bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-600/20">
            {t.error}
            <button onClick={() => t.setError(null)}><X size={14} /></button>
          </div>
        ) : null}

        <TasksFilters
          statusTab={t.statusTab}
          onStatusTab={t.setStatusTab}
          mineOnly={t.mineOnly}
          onToggleMine={() => t.setMineOnly(!t.mineOnly)}
          priorityFilter={t.priorityFilter}
          onPriorityFilter={t.setPriorityFilter}
        />

        <TasksTable tasks={t.filtered} onOpen={t.setOpenTask} />
      </DashboardShell>

      {t.showCreate ? (
        <TaskCreateDialog
          assignees={assignees}
          customers={customers}
          actionConfig={actionConfig}
          onCreated={t.addTask}
          onError={t.setError}
          onClose={() => t.setShowCreate(false)}
        />
      ) : null}

      {t.openTask ? (
        <TaskDetailDrawer
          key={t.openTask.id}
          task={t.openTask}
          actionConfig={actionConfig}
          onClose={() => t.setOpenTask(null)}
          onTaskUpdated={t.updateTask}
          onTaskDeleted={t.removeTask}
          onError={t.setError}
        />
      ) : null}
    </>
  );
}
