"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { refreshBadges } from "@/features/shell/badge-refresh";
import type { Task, TaskAttachment, TaskComment } from "./tasks-api";
import type { TasksActionConfig } from "./tasks-shared";

interface Options {
  initialTask: Task;
  actionConfig: TasksActionConfig;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (id: string) => void;
  onError: (message: string | null) => void;
}

interface TaskDetail { task: Task; comments: TaskComment[]; attachments: TaskAttachment[] }

/** Detail-drawer state: the loaded task + comments + attachments, status changes,
 *  and delete (creator-only, finished tasks). */
export function useTaskDetail({ initialTask, actionConfig, onClose, onTaskUpdated, onTaskDeleted, onError }: Options) {
  const [task, setTask] = useState(initialTask);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete =
    task.createdBy === actionConfig.currentUserId && (task.status === "done" || task.status === "cancelled");

  useEffect(() => {
    let cancelled = false;
    void apiRequest<TaskDetail>(actionConfig, "GET", `/tasks/${initialTask.id}`)
      .then((detail) => {
        if (cancelled) return;
        setTask(detail.task);
        setComments(detail.comments);
        setAttachments(detail.attachments);
      })
      .catch((e) => { if (!cancelled) onError(errorMessage(e, "Could not load the task.")); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [initialTask.id, actionConfig, onError]);

  async function changeStatus(status: string) {
    try {
      const updated = await apiRequest<Task>(actionConfig, "PATCH", `/tasks/${task.id}`, { status });
      setTask(updated);
      onTaskUpdated(updated);
      refreshBadges();
    } catch (e) {
      onError(errorMessage(e, "Could not update the task."));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiRequest(actionConfig, "DELETE", `/tasks/${task.id}`);
      onTaskDeleted(task.id);
      refreshBadges();
      onClose();
    } catch (e) {
      onError(errorMessage(e, "Could not delete the task."));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return {
    task, comments, attachments, detailLoading, confirmingDelete, setConfirmingDelete, deleting, canDelete,
    changeStatus, handleDelete,
    addComment: (c: TaskComment) => setComments((prev) => [...prev, c]),
    addAttachment: (a: TaskAttachment) => setAttachments((prev) => [...prev, a]),
  };
}
