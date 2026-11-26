import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useAdminAlerts } from "./use-admin-alerts";
import type { InvoiceNotification } from "./invoice-notifications";

const push = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const fetchNotifications = vi.fn<() => Promise<InvoiceNotification[]>>(() => Promise.resolve([]));
const markNotificationRead = vi.fn();
const deleteNotification = vi.fn();
const clearAllNotifications = vi.fn();

vi.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => push(...a) },
  useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]),
}));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a) }) }));
vi.mock("./invoice-notifications", () => ({
  fetchNotifications: () => fetchNotifications(),
  markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
  deleteNotification: (...a: unknown[]) => deleteNotification(...a),
  clearAllNotifications: (...a: unknown[]) => clearAllNotifications(...a),
}));

const notif = (o: Partial<InvoiceNotification>): InvoiceNotification => ({ id: "n1", type: "invoice", title: "T", body: null, invoiceId: null, customerId: null, createdAt: "", readAt: null, ...o });
beforeEach(() => { fetchNotifications.mockResolvedValue([notif({ id: "a1" })]); confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("useAdminAlerts load", () => {
  it("loads the feed on focus and clears loading", async () => {
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.items).toEqual([notif({ id: "a1" })]);
    expect(result.current.loading).toBe(false);
  });
  it("keeps prior items when the fetch fails", async () => {
    fetchNotifications.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
  it("pull-to-refresh reloads", async () => {
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    fetchNotifications.mockClear();
    await act(async () => { await result.current.onRefresh(); });
    expect(fetchNotifications).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });
});

describe("useAdminAlerts.onOpen", () => {
  it("marks an unread alert and opens the customer", async () => {
    fetchNotifications.mockResolvedValue([notif({ id: "a1" }), notif({ id: "a2" })]);
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.onOpen(notif({ id: "a1", customerId: "c2" })));
    expect(markNotificationRead).toHaveBeenCalledWith("a1");
    expect(push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c2" } });
    expect(result.current.items.find((n) => n.id === "a1")?.readAt).toBeTruthy(); // only a1 flipped
    expect(result.current.items.find((n) => n.id === "a2")?.readAt).toBeNull();
  });
  it("does not re-mark a read alert and skips navigation without a customer", async () => {
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.onOpen(notif({ readAt: "2026-01-01", customerId: null })));
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("useAdminAlerts.onDelete / onClearAll", () => {
  it("removes one optimistically then on the server", async () => {
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.onDelete("a1"));
    expect(result.current.items).toEqual([]);
    expect(deleteNotification).toHaveBeenCalledWith("a1");
  });
  it("clears all after confirmation", async () => {
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.onClearAll(); });
    expect(result.current.items).toEqual([]);
    expect(clearAllNotifications).toHaveBeenCalled();
  });
  it("aborts clear-all when declined", async () => {
    confirm.mockResolvedValue(false);
    const { result } = renderHook(() => useAdminAlerts());
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.onClearAll(); });
    expect(clearAllNotifications).not.toHaveBeenCalled();
  });
});
