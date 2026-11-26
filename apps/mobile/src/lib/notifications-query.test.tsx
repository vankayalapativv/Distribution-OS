import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { NOTIFICATIONS_KEY, unreadCount, useNotificationsCache, useNotificationsQuery } from "./notifications-query";
import { cacheKeys } from "./cache-keys";
import type { InvoiceNotification } from "./invoice-notifications";

const useCachedQuery = vi.fn((cfg: unknown) => ({ cfg }));
const setQueryData = vi.fn();
const refetchQueries = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const fetchNotifications = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ setQueryData: (...a: unknown[]) => setQueryData(...a), refetchQueries: (...a: unknown[]) => refetchQueries(...a) }) }));
vi.mock("./use-cached-query", () => ({ useCachedQuery: (c: unknown) => useCachedQuery(c) }));
vi.mock("./invoice-notifications", () => ({ fetchNotifications: () => fetchNotifications() }));

const notif = (id: string, readAt: string | null): InvoiceNotification => ({ id, type: "t", title: "T", body: null, invoiceId: null, customerId: null, createdAt: "", readAt });
afterEach(() => vi.clearAllMocks());

describe("useNotificationsQuery", () => {
  it("subscribes to the shared feed with a 60s poll", async () => {
    renderHook(() => useNotificationsQuery());
    expect(useCachedQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: NOTIFICATIONS_KEY, cacheKey: cacheKeys.notifications, fetcher: expect.any(Function), refetchInterval: 60_000,
    }));
    // the configured fetcher pulls the shared /me/notifications feed
    await (useCachedQuery.mock.calls[0][0] as { fetcher: () => unknown }).fetcher();
    expect(fetchNotifications).toHaveBeenCalled();
  });
});

describe("unreadCount", () => {
  it("counts only unread notifications, 0 for undefined", () => {
    expect(unreadCount(undefined)).toBe(0);
    expect(unreadCount([notif("1", null), notif("2", "2026-01-01"), notif("3", null)])).toBe(2);
  });
});

describe("useNotificationsCache", () => {
  it("patches the inner list of the read-cache wrapper, no-op when empty", () => {
    const { result } = renderHook(() => useNotificationsCache());
    result.current.patch((list) => list.filter((n) => n.id !== "1"));
    const [key, updater] = setQueryData.mock.calls[0] as [unknown, (p: unknown) => unknown];
    expect(key).toBe(NOTIFICATIONS_KEY);
    expect(updater({ data: [notif("1", null), notif("2", null)], fromCache: false })).toEqual({ data: [notif("2", null)], fromCache: false });
    expect(updater(undefined)).toBeUndefined(); // nothing cached yet
  });
  it("refetch delegates to the query client", () => {
    const { result } = renderHook(() => useNotificationsCache());
    void result.current.refetch();
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_KEY });
  });
});
