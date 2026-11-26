import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setNotificationHandler = vi.fn();
const setNotificationChannelAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getPermissionsAsync = vi.fn<(...a: unknown[]) => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: true }));
const requestPermissionsAsync = vi.fn<(...a: unknown[]) => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: true }));
const scheduleNotificationAsync = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("notif-1"));

vi.mock("expo-notifications", () => ({
  setNotificationHandler: (...a: unknown[]) => setNotificationHandler(...a),
  setNotificationChannelAsync: (...a: unknown[]) => setNotificationChannelAsync(...a),
  getPermissionsAsync: (...a: unknown[]) => getPermissionsAsync(...a),
  requestPermissionsAsync: (...a: unknown[]) => requestPermissionsAsync(...a),
  scheduleNotificationAsync: (...a: unknown[]) => scheduleNotificationAsync(...a),
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

import { ensureNotificationPermission, installNotificationHandler, scheduleReminderNotification } from "./reminders-notify";

beforeEach(() => {
  setNotificationChannelAsync.mockResolvedValue(undefined);
  getPermissionsAsync.mockResolvedValue({ granted: true });
  requestPermissionsAsync.mockResolvedValue({ granted: true });
});
afterEach(() => vi.clearAllMocks());

describe("installNotificationHandler", () => {
  it("registers a foreground handler that shows the banner", async () => {
    installNotificationHandler();
    const cfg = setNotificationHandler.mock.calls[0][0] as { handleNotification: () => Promise<unknown> };
    await expect(cfg.handleNotification()).resolves.toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
  });
});

describe("ensureNotificationPermission", () => {
  it("returns true when permission is already granted (no ask)", async () => {
    expect(await ensureNotificationPermission()).toBe(true);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it("asks when not yet granted and honours the answer", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false });
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await ensureNotificationPermission()).toBe(true);
    requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await ensureNotificationPermission()).toBe(false);
  });
  it("treats a failing permission read as not-granted and asks", async () => {
    getPermissionsAsync.mockRejectedValue(new Error("boom"));
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await ensureNotificationPermission()).toBe(true);
  });
  it("swallows a channel-setup failure and still resolves", async () => {
    setNotificationChannelAsync.mockRejectedValue(new Error("no channel"));
    expect(await ensureNotificationPermission()).toBe(true);
  });
  it("returns false when the request itself fails", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false });
    requestPermissionsAsync.mockRejectedValue(new Error("denied"));
    expect(await ensureNotificationPermission()).toBe(false);
  });
});

describe("scheduleReminderNotification", () => {
  it("appends the customer name to the body when present", async () => {
    await scheduleReminderNotification({ title: "Call", remindAt: new Date(), customerId: "c1", customerName: "Balaji" });
    const req = scheduleNotificationAsync.mock.calls[0][0] as { content: { body: string; data: { customerId: string | null } } };
    expect(req.content.body).toBe("Call — Balaji");
    expect(req.content.data.customerId).toBe("c1");
  });
  it("uses the bare title and null customer when no name/id is given", async () => {
    await scheduleReminderNotification({ title: "Call", remindAt: new Date() });
    const req = scheduleNotificationAsync.mock.calls[0][0] as { content: { body: string; data: { customerId: string | null } } };
    expect(req.content.body).toBe("Call");
    expect(req.content.data.customerId).toBeNull();
  });
});
