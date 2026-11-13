"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { CustomerPhoto } from "./customer-photos-tab";
import { notesKey, type CustomerNote } from "./customer-note-item";
import type { Order } from "@/features/orders/orders-api";

/** The three side queries the detail page shows across its tabs: profile photos,
 *  the latest 5 orders (+ total), and the all-time visit count. */
export function useCustomerDetailData(customerId: string, actionConfig: ActionConfig) {
  const photosQuery = useQuery({
    queryKey: ["customer-photos", customerId],
    queryFn: () =>
      apiGet<{ photos: CustomerPhoto[] }>(actionConfig, `/customers/${customerId}/photos?category=customer`),
  });

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: () =>
      apiGet<{ orders: Order[]; total: number }>(
        actionConfig,
        `/orders/paged?customerId=${customerId}&sort=orderDate&dir=desc&pageSize=5`,
      ),
  });

  const visitsCountQuery = useQuery({
    queryKey: ["customer-visits-count", customerId],
    queryFn: () =>
      apiGet<{ summary: { all: number } }>(actionConfig, `/customers/${customerId}/visits?pageSize=1`),
  });

  // Shares the Notes tab's query key, so this count fetch also warms that tab.
  const notesQuery = useQuery({
    queryKey: notesKey(customerId),
    queryFn: () => apiGet<{ notes: CustomerNote[] }>(actionConfig, `/customers/${customerId}/notes`),
  });

  return {
    photos: photosQuery.data?.photos ?? [],
    photosLoading: photosQuery.isLoading,
    orders: ordersQuery.data?.orders ?? [],
    ordersTotal: ordersQuery.data?.total ?? 0,
    ordersLoading: ordersQuery.isLoading,
    visitsCount: visitsCountQuery.data?.summary.all ?? 0,
    visitsLoading: visitsCountQuery.isLoading,
    notesCount: notesQuery.data?.notes.length ?? 0,
    notesLoading: notesQuery.isLoading,
  };
}
