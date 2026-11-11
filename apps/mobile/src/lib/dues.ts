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

// Server-driven: a band key is the enterprise band's ordinal as a string
// ("0".."N-1"). The old fixed keys ("0_30"…) are gone — each enterprise defines
// its own ageing bands in onboarding, and the API returns them.
export type DuesBucketKey = string;

export interface DuesBand {
  key: string;
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
}

export interface DuesBucketSummary {
  key: DuesBucketKey;
  label: string;
  fromDays: number;
  toDays: number | null;
  customers: number;
  outstanding: number;
}

export interface DuesSummary {
  /** The enterprise's ageing bands (ordered). */
  bands: DuesBand[];
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
