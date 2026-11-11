"use client";

import { useMemo, useState } from "react";
import { useUrlState } from "@/lib/use-url-state";
import type { Task } from "./tasks-api";
import { STATUS_TABS, type StatusTabKey, type TasksActionConfig } from "./tasks-shared";

const STATUS_KEYS = STATUS_TABS.map((t) => t.key) as readonly StatusTabKey[];

/**
 * Tasks list state. The filters (status tab, my-tasks, priority) live in the URL
 * with `replace` (Back/refresh restore them, no history noise); the task detail
 * drawer lives in the URL with `push` (`?task=<id>`), so opening it is a history
 * entry and the browser Back button closes it. The create dialog stays local.
 */
export function useTasksList(initialTasks: Task[], actionConfig: TasksActionConfig) {
  const [tasks, setTasks] = useState(initialTasks);
  const { get, set } = useUrlState();

  const rawStatus = get("status");
  const statusTab: StatusTabKey = (STATUS_KEYS as readonly string[]).includes(rawStatus)
    ? (rawStatus as StatusTabKey)
    : "open";
  const mineOnly = get("mine") === "1";
  const priorityFilter = get("priority");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const openId = get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (statusTab !== "all" && t.status !== statusTab) return false;
        if (mineOnly && t.assignedTo !== actionConfig.currentUserId) return false;
        if (priorityFilter && t.priority !== priorityFilter) return false;
        return true;
      }),
    [tasks, statusTab, mineOnly, priorityFilter, actionConfig.currentUserId],
  );

  const openCount = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return {
    tasks,
    statusTab,
    setStatusTab: (v: StatusTabKey) => set({ status: v === "open" ? null : v }),
    mineOnly,
    setMineOnly: (v: boolean) => set({ mine: v ? "1" : null }),
    priorityFilter,
    setPriorityFilter: (v: string) => set({ priority: v || null }),
    error, setError, showCreate, setShowCreate,
    openTask,
    setOpenTask: (task: Task | null) => set({ task: task ? task.id : null }, task ? "push" : "replace"),
    filtered, openCount,
    addTask: (task: Task) => setTasks((prev) => [task, ...prev]),
    updateTask: (updated: Task) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t))),
    removeTask: (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id)),
  };
}
