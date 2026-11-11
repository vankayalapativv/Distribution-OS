import { vi } from "vitest";
import type { ServerAssignedTask } from "./assigned-tasks";
import type { LocalDb } from "./local-db";

export const scheduled: { id: string; date: Date }[] = [];
export const cancelled: string[] = [];

export function notificationsMock() {
  return {
    scheduleNotificationAsync: vi.fn(async (req: { trigger: { date: Date } }) => {
      const id = `notif-${scheduled.length + 1}`;
      scheduled.push({ id, date: req.trigger.date });
      return id;
    }),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
      cancelled.push(id);
    }),
    SchedulableTriggerInputTypes: { DATE: "date" },
  };
}

export const NOW = 1_754_000_000_000; // fixed "now"

export function serverTask(overrides: Partial<ServerAssignedTask> = {}): ServerAssignedTask {
  return {
    id: "task-1",
    title: "Call RK Automobiles",
    description: "Follow up on payment",
    priority: "high",
    status: "open",
    remindAt: new Date(NOW + 3_600_000).toISOString(), // 1h out
    customerId: "cust-1",
    customerName: "RK Automobiles",
    createdByName: "Mohan Manager",
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}
