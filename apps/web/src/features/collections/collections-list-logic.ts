import type { SortingState } from "@tanstack/react-table";

export type CollectionsRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

/** Status options for the filter Select (accountant approval status). */
export const COLLECTION_STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All collections" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

/** URL param names (also the API's filter param names). "date" is a single day
 *  mapped to fromDate == toDate for the API. Module scope keeps the reference
 *  stable for useTableUrlState. */
export const COLLECTION_FILTER_KEYS = ["status", "search", "customerId", "collectedBy", "date"] as const;

export const COLLECTION_SORT: SortingState = [{ id: "collectionDate", desc: true }];

/** "yyyy-MM-dd" → a local Date (avoids the UTC day-shift of `new Date(str)`). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
