/**
 * Collection-dues ageing for the SE Home card (online-only). A customer with
 * outstanding sits in exactly one bucket, by the age of their oldest unpaid
 * invoice (from the invoice date). Both the Home summary and the bucket
 * drill-down fetch straight from the API; a failure returns null so the screen
 * shows its error/empty state.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { cacheKeys } from "./cache-keys";
import { cachedFetch } from "./read-cache";

export type DuesBucketKey = "0_30" | "30_45" | "45_60" | "60_plus";

export interface DuesBucketSummary {
  key: DuesBucketKey;
  label: string;
  customers: number;
  outstanding: number;
}

export interface DuesSummary {
  buckets: DuesBucketSummary[];
  totalCustomers: number;
  totalOutstanding: number;
}

export interface DuesCustomer {
  customerId: string;
  customerName: string;
  oldestInvoiceDate: string;
  ageDays: number;
  outstanding: number;
}

/** SE Home dues card — online-only; null when the fetch fails. */
export async function fetchDuesSummary(): Promise<DuesSummary | null> {
  const token = useAuth.getState().token;
  try {
    const r = await cachedFetch(cacheKeys.duesSummary, () =>
      apiFetch<DuesSummary>("/dues/me/summary", { token }),
    );
    return r.data;
  } catch {
    return null;
  }
}

export async function fetchDuesCustomers(
  bucket: DuesBucketKey,
): Promise<{ bucket: DuesBucketKey; customers: DuesCustomer[] } | null> {
  const token = useAuth.getState().token;
  try {
    const r = await cachedFetch(cacheKeys.duesBucket(bucket), () =>
      apiFetch<{ bucket: DuesBucketKey; customers: DuesCustomer[] }>(
        `/dues/me/customers?bucket=${bucket}`,
        { token },
      ),
    );
    return r.data;
  } catch {
    // Fetch failed AND no cache → the drill-down shows its empty/error state.
    return null;
  }
}
