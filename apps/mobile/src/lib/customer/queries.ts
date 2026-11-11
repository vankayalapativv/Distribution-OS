/**
 * Data hook for the customer-detail screen. Each read is a network-first,
 * read-through cache (useCachedQuery): on a cold screen it paints the last-synced
 * copy instantly then revalidates; offline it falls back to cache; with no cache
 * a failure surfaces as the section's error state with a Retry button.
 */
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import { cacheKeys } from "../cache-keys";
import { useCachedQuery } from "../use-cached-query";
import type { Credit, CustomerHeader, ServerCollection, ServerOrder } from "./types";

async function fetchHeader(id: string, token: string | null) {
  return apiFetch<CustomerHeader>(`/customers/${id}`, { token });
}

async function fetchCredit(id: string, token: string | null): Promise<Credit> {
  const d = await apiFetch<Credit>(`/customers/${id}/invoices`, { token });
  return {
    creditBlocked: d.creditBlocked,
    creditOverdueDays: d.creditOverdueDays,
    totalOutstanding: d.totalOutstanding,
  };
}

async function fetchLastOrders(id: string, token: string | null) {
  const d = await apiFetch<{ orders: ServerOrder[] }>(`/orders?customerId=${id}`, { token });
  return d.orders.slice(0, 5);
}

async function fetchLastCollections(id: string, token: string | null) {
  const d = await apiFetch<ServerCollection[]>(`/collections?customerId=${id}`, { token });
  return d.slice(0, 5);
}

export function useCustomerScreen(id: string | undefined, token: string | null) {
  const qc = useQueryClient();
  const enabled = Boolean(id && token);
  const cid = id ?? "";

  const headerQuery = useCachedQuery({
    queryKey: ["customer", id],
    cacheKey: cacheKeys.customerHeader(cid),
    fetcher: () => fetchHeader(cid, token),
    enabled,
  });
  const creditQuery = useCachedQuery({
    queryKey: ["credit", id],
    cacheKey: cacheKeys.customerCredit(cid),
    fetcher: () => fetchCredit(cid, token),
    enabled,
    staleTime: 0,
  });
  const ordersQuery = useCachedQuery({
    queryKey: ["orders", id],
    cacheKey: cacheKeys.customerOrders(cid),
    fetcher: () => fetchLastOrders(cid, token),
    enabled,
  });
  const collectionsQuery = useCachedQuery({
    queryKey: ["collections", id],
    cacheKey: cacheKeys.customerCollections(cid),
    fetcher: () => fetchLastCollections(cid, token),
    enabled,
  });

  const invalidate = () =>
    Promise.all(
      ["customer", "credit", "orders", "collections"].map((k) =>
        qc.invalidateQueries({ queryKey: [k, id] }),
      ),
    );

  return { headerQuery, creditQuery, ordersQuery, collectionsQuery, invalidate };
}
