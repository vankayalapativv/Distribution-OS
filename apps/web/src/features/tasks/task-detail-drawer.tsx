"use client";

import { X } from "lucide-react";
import type { Task } from "./tasks-api";
import { formatDate, type TasksActionConfig } from "./tasks-shared";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";
import { TaskDetailMeta } from "./task-detail-meta";
import { TaskStatusActions } from "./task-status-actions";
import { TaskDeleteSection } from "./task-delete-section";
import { useTaskDetail } from "./use-task-detail";

export function TaskDetailDrawer({
  task: initialTask, actionConfig, onClose, onTaskUpdated, onTaskDeleted, onError,
}: {
  readonly task: Task;
  readonly actionConfig: TasksActionConfig;
  readonly onClose: () => void;
  readonly onTaskUpdated: (task: Task) => void;
  readonly onTaskDeleted: (id: string) => void;
  readonly onError: (message: string | null) => void;
}) {
  const d = useTaskDetail({ initialTask, actionConfig, onClose, onTaskUpdated, onTaskDeleted, onError });
  const { task } = d;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}
      role="button" tabIndex={0} aria-label="Close"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") onClose(); }}>
      <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">by {task.createdByName ?? "—"} · {formatDate(task.createdAt)}</p>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-5 py-4">
          {task.description ? <p className="text-sm text-foreground">{task.description}</p> : null}

          <TaskDetailMeta task={task} />
          <TaskStatusActions status={task.status} onChange={d.changeStatus} />

          <TaskAttachments
            taskId={task.id} attachments={d.attachments} loading={d.detailLoading}
            actionConfig={actionConfig} onError={onError} onAdded={d.addAttachment}
          />
          <TaskComments
            taskId={task.id} comments={d.comments} loading={d.detailLoading}
            actionConfig={actionConfig} onError={onError} onAdded={d.addComment}
          />

          {d.canDelete ? (
            <TaskDeleteSection
              confirming={d.confirmingDelete} setConfirming={d.setConfirmingDelete}
              deleting={d.deleting} onDelete={d.handleDelete}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
