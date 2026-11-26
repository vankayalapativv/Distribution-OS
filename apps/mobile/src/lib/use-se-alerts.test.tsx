import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSeAlerts } from "./use-se-alerts";
import type { InvoiceNotification } from "./invoice-notifications";

const push = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const markNotificationRead = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteNotification = vi.fn();
const clearAllNotifications = vi.fn();
const patch = vi.fn();
const refetch = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let query: { isPending: boolean; data?: InvoiceNotification[] } = { isPending: false, data: [] };

vi.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => push(...a) } }));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a) }) }));
vi.mock("./invoice-notifications", () => ({
  markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
  deleteNotification: (...a: unknown[]) => deleteNotification(...a),
  clearAllNotifications: (...a: unknown[]) => clearAllNotifications(...a),
}));
vi.mock("./notifications-query", () => ({
  useNotificationsQuery: () => query,
  useNotificationsCache: () => ({ patch: (...a: unknown[]) => patch(...a), refetch: (...a: unknown[]) => refetch(...a) }),
}));

const notif = (o: Partial<InvoiceNotification>): InvoiceNotification => ({ id: "n1", type: "invoice", title: "T", body: null, invoiceId: null, customerId: null, createdAt: "", readAt: null, ...o });
beforeEach(() => { query = { isPending: false, data: [] }; confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("useSeAlerts state", () => {
  it("is null during the first load, else the data", () => {
    query = { isPending: true };
    expect(renderHook(() => useSeAlerts()).result.current.notifications).toBeNull();
    query = { isPending: false, data: undefined };
    expect(renderHook(() => useSeAlerts()).result.current.notifications).toEqual([]);
  });
  it("reload + pull-to-refresh refetch the shared cache", async () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.reload());
    expect(refetch).toHaveBeenCalled();
    await act(async () => { await result.current.onRefresh(); });
    expect(result.current.refreshing).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});

describe("useSeAlerts.markRead", () => {
  it("marks an unread alert, patching only that row, and swallows a server error", async () => {
    markNotificationRead.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.markRead(notif({ id: "n5" })));
    await act(async () => { await Promise.resolve(); }); // let the .catch settle
    expect(markNotificationRead).toHaveBeenCalledWith("n5");
    const updater = patch.mock.calls[0][0] as (l: InvoiceNotification[]) => InvoiceNotification[];
    const out = updater([notif({ id: "n5" }), notif({ id: "zz" })]);
    expect(out.find((n) => n.id === "n5")?.readAt).toBeTruthy();
    expect(out.find((n) => n.id === "zz")?.readAt).toBeNull();
  });
  it("ignores an already-read alert", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.markRead(notif({ readAt: "2026-01-01" })));
    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});

describe("useSeAlerts.onOpen / onDues", () => {
  it("opens the invoice preview (marking it read first)", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.onOpen(notif({ invoiceId: "inv9", title: "Invoice 9" })));
    expect(markNotificationRead).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ pathname: "/invoice/[id]", params: { id: "inv9", title: "Invoice 9" } });
  });
  it("does nothing opening an alert with no invoice", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.onOpen(notif({ invoiceId: null })));
    expect(push).not.toHaveBeenCalled();
  });
  it("skips the re-mark when the invoice alert is already read", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.onOpen(notif({ invoiceId: "inv9", readAt: "2026-01-01" })));
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalled();
  });
  it("opens the customer ledger for a dues alert, stripping the prefix", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.onDues(notif({ customerId: "c3", title: "Dues alert: Balaji Motors" })));
    expect(push).toHaveBeenCalledWith({ pathname: "/ledger/[id]", params: { id: "c3", customerName: "Balaji Motors" } });
  });
  it("marks a dues alert read even when it has no customer", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.onDues(notif({ customerId: null })));
    expect(markNotificationRead).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("useSeAlerts.deleteOne / clearAll", () => {
  it("optimistically removes then deletes on the server", () => {
    const { result } = renderHook(() => useSeAlerts());
    act(() => result.current.deleteOne("n7"));
    const updater = patch.mock.calls[0][0] as (l: InvoiceNotification[]) => InvoiceNotification[];
    expect(updater([notif({ id: "n7" }), notif({ id: "keep" })]).map((n) => n.id)).toEqual(["keep"]);
    expect(deleteNotification).toHaveBeenCalledWith("n7");
  });
  it("clears all after confirmation", async () => {
    query = { isPending: false, data: [notif({})] };
    const { result } = renderHook(() => useSeAlerts());
    await act(async () => { await result.current.clearAll(); });
    const updater = patch.mock.calls[0][0] as (l: InvoiceNotification[]) => InvoiceNotification[];
    expect(updater([notif({})])).toEqual([]); // clear-all empties the list
    expect(clearAllNotifications).toHaveBeenCalled();
  });
  it("does nothing clearing an empty feed", async () => {
    const { result } = renderHook(() => useSeAlerts());
    await act(async () => { await result.current.clearAll(); });
    expect(confirm).not.toHaveBeenCalled();
  });
  it("aborts clear-all when declined", async () => {
    query = { isPending: false, data: [notif({})] };
    confirm.mockResolvedValue(false);
    const { result } = renderHook(() => useSeAlerts());
    await act(async () => { await result.current.clearAll(); });
    expect(clearAllNotifications).not.toHaveBeenCalled();
  });
});
