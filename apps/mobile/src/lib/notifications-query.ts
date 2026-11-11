/**
 * The single source of truth for the SE's /me/notifications feed. Both the tab
 * badge (always-mounted TabsLayout) and the Alerts list read this ONE react-query
 * cache, so there's one shared 60s poll + on-demand refetches instead of three
 * independent fetchers hammering the endpoint. On error react-query keeps the
 * last-good data, so the badge/list survive a flaky connection.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { cacheKeys } from "./cache-keys";
import { fetchNotifications, type InvoiceNotification } from "./invoice-notifications";
import type { CachedResult } from "./read-cache";
import { useCachedQuery } from "./use-cached-query";

export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** Subscribe to the shared notifications feed (60s background poll), read-through
 *  cached so the list survives offline from the last sync. */
export function useNotificationsQuery() {
  return useCachedQuery({
    queryKey: NOTIFICATIONS_KEY,
    cacheKey: cacheKeys.notifications,
    fetcher: fetchNotifications,
    refetchInterval: 60_000,
  });
}

export function unreadCount(list: InvoiceNotification[] | undefined): number {
  return list?.filter((n) => !n.readAt).length ?? 0;
}

/** Cache mutators shared by the Alerts screen — patch the ONE cache so the badge
 *  (derived from the same data) updates in lockstep, no separate refresh needed. */
export function useNotificationsCache() {
  const qc = useQueryClient();
  const patch = useCallback(
    (fn: (list: InvoiceNotification[]) => InvoiceNotification[]) => {
      // The query data is the read-cache wrapper { data, fromCache }; patch the
      // inner list so the badge (derived from the same data) updates in lockstep.
      qc.setQueryData<CachedResult<InvoiceNotification[]>>(NOTIFICATIONS_KEY, (prev) =>
        prev ? { ...prev, data: fn(prev.data) } : prev,
      );
    },
    [qc],
  );
  const refetch = useCallback(
    () => qc.refetchQueries({ queryKey: NOTIFICATIONS_KEY }),
    [qc],
  );
  return { patch, refetch };
}
