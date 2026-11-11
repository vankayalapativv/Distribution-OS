// Loads every deliverable invoice (logistics is network-first) and filters it by
// search + invoices already delivered locally this run — those aren't on the
// server's pending list until sync, so hiding them prevents a double delivery.

import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { cacheKeys } from "./cache-keys";
import { getLocalDb } from "./db";
import type { DeliverableInvoice } from "./deliverable-invoice";
import { getDeliveryStops } from "./sync-core";
import { useCachedQuery } from "./use-cached-query";

export function useDeliverableInvoices(token: string | null, runClientUuid: string | undefined) {
  const invoicesQuery = useCachedQuery({
    queryKey: ["deliverable-invoices"],
    cacheKey: cacheKeys.deliverableInvoices,
    fetcher: () => apiFetch<{ invoices: DeliverableInvoice[] }>("/deliveries/pending-invoices", { token }),
    enabled: Boolean(token),
  });
  const invoices = invoicesQuery.data?.invoices ?? [];

  const [search, setSearch] = useState("");
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(() => new Set());

  const reset = useCallback(() => {
    setSearch("");
    const db = getLocalDb();
    setDeliveredIds(
      db && runClientUuid
        ? new Set(
            getDeliveryStops(db, runClientUuid)
              .map((s) => s.invoiceId)
              .filter((id): id is string => !!id),
          )
        : new Set(),
    );
  }, [runClientUuid]);

  const filtered = useMemo(() => {
    const available = invoices.filter((inv) => !deliveredIds.has(inv.id));
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) || (inv.customerName ?? "").toLowerCase().includes(q),
    );
  }, [invoices, search, deliveredIds]);

  return { invoicesQuery, filtered, search, setSearch, reset };
}
