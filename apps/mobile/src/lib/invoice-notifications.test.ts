import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ notifications: [] }));
let token: string | null = "tok";
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
// Re-exported expo-heavy modules — stub so the node import stays clean.
vi.mock("./invoice-pdf", () => ({ downloadInvoicePdf: vi.fn(), shareInvoiceFile: vi.fn(), shareInvoicePdf: vi.fn() }));
vi.mock("./push-token", () => ({ registerPushToken: vi.fn() }));

import {
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
} from "./invoice-notifications";

beforeEach(() => { token = "tok"; apiFetch.mockResolvedValue({ notifications: [] }); });
afterEach(() => vi.clearAllMocks());

describe("fetchNotifications", () => {
  it("returns the feed for a signed-in user", async () => {
    apiFetch.mockResolvedValue({ notifications: [{ id: "n1" }] });
    expect(await fetchNotifications()).toEqual([{ id: "n1" }]);
    expect(apiFetch).toHaveBeenCalledWith("/me/notifications", { token: "tok" });
  });
  it("returns [] when signed out", async () => {
    token = null;
    expect(await fetchNotifications()).toEqual([]);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("markNotificationRead", () => {
  it("posts a read marker", async () => {
    await markNotificationRead("n1");
    expect(apiFetch).toHaveBeenCalledWith("/me/notifications/n1/read", expect.objectContaining({ method: "POST" }));
  });
  it("no-ops when signed out", async () => {
    token = null;
    await markNotificationRead("n1");
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("swallows a failure", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    await expect(markNotificationRead("n1")).resolves.toBeUndefined();
  });
});

describe("deleteNotification", () => {
  it("deletes the notification", async () => {
    await deleteNotification("n1");
    expect(apiFetch).toHaveBeenCalledWith("/me/notifications/n1", { method: "DELETE", token: "tok" });
  });
  it("no-ops when signed out and swallows failures", async () => {
    token = null;
    await deleteNotification("n1");
    expect(apiFetch).not.toHaveBeenCalled();
    token = "tok";
    apiFetch.mockRejectedValue(new Error("x"));
    await expect(deleteNotification("n1")).resolves.toBeUndefined();
  });
});

describe("clearAllNotifications", () => {
  it("clears the whole feed", async () => {
    await clearAllNotifications();
    expect(apiFetch).toHaveBeenCalledWith("/me/notifications", { method: "DELETE", token: "tok" });
  });
  it("no-ops when signed out and swallows failures", async () => {
    token = null;
    await clearAllNotifications();
    expect(apiFetch).not.toHaveBeenCalled();
    token = "tok";
    apiFetch.mockRejectedValue(new Error("x"));
    await expect(clearAllNotifications()).resolves.toBeUndefined();
  });
});
