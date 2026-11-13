/**
 * On-sync prefetch of read data into the SQLite read-cache, so screens work
 * offline even for records the SE never opened. Runs from kickSync (launch /
 * reconnect / foreground / the day-on tick), throttled so it doesn't refetch on
 * every tick. Every call is best-effort: a failed endpoint just leaves that
 * cache slot at its previous value — it never throws into the sync loop.
 *
 * Coverage: it writes the SAME cache keys the screens read (see cache-keys.ts).
 * Bulk/self-scoped data (customers, performance, dues, beat, notifications, the
 * order catalogue, deliveries) plus per-customer LEDGER and recent ORDERS (via
 * the bulk endpoints) are covered here. Per-customer header/credit/collections/
 * notes/photos have no bulk endpoint, so they cache on first open.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { cacheKeys } from "./cache-keys";
import { fetchTodayBeat } from "./beat/today-beat-online";
import { fetchSeCustomers } from "./customer-directory";
import type { ServerOrder } from "./customer/types";
import { fetchDuesCustomers, fetchDuesSummary } from "./dues";
import { getIsOnline } from "./connectivity";
import { fetchNotifications } from "./invoice-notifications";
import type { LedgerData } from "./ledger";
import { fetchOils } from "./order/api";
import { fetchMyPerformance } from "./performance";
import { shouldPrefetch } from "./prefetch-throttle";
import { cachedFetch, writeCache } from "./read-cache";

const PREFETCH_INTERVAL_MS = 5 * 60 * 1000;
let lastPrefetchAt = 0;

/** Swallow a rejection so one failed endpoint never aborts the batch. */
const quiet = (p: Promise<unknown>) => p.catch(() => undefined);

/** Prefetch the SE dues summary + each ageing band's customer list. Band keys are
 *  SERVER-DRIVEN (enterprise ordinals), so they come from the summary — never a
 *  hardcoded set, which no longer matches the API (the old fixed keys 422). */
async function prefetchDues(): Promise<void> {
  const summary = await fetchDuesSummary();
  if (!summary) return;
  await Promise.allSettled(summary.buckets.map((b) => fetchDuesCustomers(b.key)));
}

/** Per-customer ledgers in ONE call → write each to the key the ledger screen reads. */
async function prefetchLedgers(token: string | null): Promise<void> {
  const res = await apiFetch<{ ledgers: { customerId: string; ledger: LedgerData }[] }>(
    "/customers/ledgers/bulk",
    { token },
  );
  for (const e of res.ledgers) writeCache(cacheKeys.ledger(e.customerId), e.ledger);
}

/** Last-5 orders for all customers in ONE call → group by customer and write each. */
async function prefetchRecentOrders(token: string | null): Promise<void> {
  const res = await apiFetch<{ orders: (ServerOrder & { customerId?: string })[] }>(
    "/orders/recent-bulk",
    { token },
  );
  const byCustomer = new Map<string, ServerOrder[]>();
  for (const o of res.orders) {
    const cid = o.customerId;
    if (!cid) continue;
    const arr = byCustomer.get(cid) ?? [];
    if (arr.length < 5) arr.push(o);
    byCustomer.set(cid, arr);
  }
  for (const [cid, orders] of byCustomer) writeCache(cacheKeys.customerOrders(cid), orders);
}

/**
 * Prefetch the SE's (or Logistics') read data into the cache. Throttled to once
 * per PREFETCH_INTERVAL_MS unless `force`.
 */
export async function prefetchReadData(opts: { force?: boolean } = {}): Promise<void> {
  const { token, user } = useAuth.getState();
  if (!token || !user || !getIsOnline()) return;
  const now = Date.now();
  if (!shouldPrefetch(now, lastPrefetchAt, PREFETCH_INTERVAL_MS, opts)) return;
  lastPrefetchAt = now;

  const jobs: Promise<unknown>[] = [];
  if (user.role === "SALES_EXECUTIVE") {
    jobs.push(
      quiet(cachedFetch(cacheKeys.customersList, () => fetchSeCustomers(token))),
      quiet(fetchMyPerformance()),
      quiet(prefetchDues()),
      quiet(fetchTodayBeat(token)),
      quiet(cachedFetch(cacheKeys.notifications, fetchNotifications)),
      quiet(cachedFetch(cacheKeys.orderOils, () => fetchOils(token))),
      quiet(prefetchLedgers(token)),
      quiet(prefetchRecentOrders(token)),
    );
  } else if (user.role === "LOGISTICS") {
    jobs.push(
      quiet(cachedFetch(cacheKeys.notifications, fetchNotifications)),
      quiet(
        cachedFetch(cacheKeys.deliverableInvoices, () =>
          apiFetch("/deliveries/pending-invoices", { token }),
        ),
      ),
    );
  }
  await Promise.allSettled(jobs);
}
