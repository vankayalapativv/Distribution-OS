import { afterEach, describe, expect, it, vi } from "vitest";
import { cancel, scheduleTaskNotification } from "./assigned-tasks-notify";

const scheduleNotificationAsync = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("notif-1"));
const cancelScheduledNotificationAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: (...a: unknown[]) => scheduleNotificationAsync(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => cancelScheduledNotificationAsync(...a),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
afterEach(() => vi.clearAllMocks());

describe("scheduleTaskNotification", () => {
  it("appends the customer name to the body when present", async () => {
    expect(await scheduleTaskNotification({ title: "Call back", customerName: "Balaji", remindAt: 1000, customerId: "c1", id: "t1" })).toBe("notif-1");
    const req = scheduleNotificationAsync.mock.calls[0][0] as { content: { body: string; data: { taskId: string } } };
    expect(req.content.body).toBe("Call back — Balaji");
    expect(req.content.data.taskId).toBe("t1");
  });
  it("uses the bare title when there's no customer", async () => {
    await scheduleTaskNotification({ title: "Admin task", customerName: null, remindAt: 1000, customerId: null, id: "t2" });
    expect((scheduleNotificationAsync.mock.calls[0][0] as { content: { body: string } }).content.body).toBe("Admin task");
  });
});

describe("cancel", () => {
  it("cancels a scheduled notification", async () => {
    await cancel("notif-9");
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-9");
  });
  it("no-ops for a null id and swallows a cancel failure", async () => {
    await cancel(null);
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    cancelScheduledNotificationAsync.mockRejectedValue(new Error("gone"));
    await expect(cancel("notif-x")).resolves.toBeUndefined();
  });
});
