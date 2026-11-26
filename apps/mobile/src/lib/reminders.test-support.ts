import { vi } from "vitest";

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
    setNotificationChannelAsync: vi.fn(async () => undefined),
    getPermissionsAsync: vi.fn(async () => ({ granted: true })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    setNotificationHandler: vi.fn(),
    SchedulableTriggerInputTypes: { DATE: "date" },
    AndroidImportance: { MAX: 5 },
  };
}
