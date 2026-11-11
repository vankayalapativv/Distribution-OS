"use client";

import { useMemo, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { refreshBadges } from "@/features/shell/badge-refresh";
import type { CustomerLite, Task, TaskAssignee } from "./tasks-api";
import { formatReminder, type TasksActionConfig } from "./tasks-shared";
import { buildRemindAt, buildTaskPayload, seTimingMissing } from "./task-payload";

interface Options {
  assignees: TaskAssignee[];
  customers: CustomerLite[];
  actionConfig: TasksActionConfig;
  onCreated: (task: Task) => void;
  onError: (message: string | null) => void;
  onClose: () => void;
}

/** All form state + derived values + submission for the New-task dialog. */
export function useTaskCreate({ assignees, customers, actionConfig, onCreated, onError, onClose }: Options) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [time, setTime] = useState("");
  const [assignee, setAssignee] = useState("");
  const [customer, setCustomer] = useState("");
  const [creating, setCreating] = useState(false);

  const officeAssignees = assignees.filter((a) => a.role !== "SALES_EXECUTIVE");
  const seAssignees = assignees.filter((a) => a.role === "SALES_EXECUTIVE");
  const selectedAssignee = assignees.find((a) => a.id === assignee) ?? null;
  const assigneeIsSe = selectedAssignee?.role === "SALES_EXECUTIVE";
  const selectedCustomer = customers.find((c) => c.id === customer) ?? null;

  const remindPreview = useMemo(() => {
    const iso = buildRemindAt(assigneeIsSe, dueDate, time);
    return iso ? formatReminder(iso) : null;
  }, [assigneeIsSe, dueDate, time]);

  const canSubmit = title.trim().length > 0 && !seTimingMissing(assigneeIsSe, dueDate, time) && !creating;

  async function handleCreate() {
    if (!title.trim()) return;
    if (seTimingMissing(assigneeIsSe, dueDate, time)) {
      return onError("Pick a date and time so the sales executive's phone reminds them.");
    }
    setCreating(true);
    onError(null);
    try {
      const task = await apiRequest<Task>(actionConfig, "POST", "/tasks",
        buildTaskPayload({ title, description, priority, dueDate, time, assignee, customer, assigneeIsSe }));
      onCreated(task);
      refreshBadges();
      onClose();
    } catch (e) {
      onError(errorMessage(e, "Could not create the task."));
    } finally {
      setCreating(false);
    }
  }

  return {
    title, setTitle, description, setDescription, priority, setPriority, dueDate, setDueDate, time, setTime,
    assignee, setAssignee, customer, setCustomer, creating,
    officeAssignees, seAssignees, selectedAssignee, assigneeIsSe, selectedCustomer, remindPreview, canSubmit,
    handleCreate,
  };
}
