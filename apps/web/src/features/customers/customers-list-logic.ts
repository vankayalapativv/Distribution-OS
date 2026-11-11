import type { SortingState } from "@tanstack/react-table";
import type { Customer } from "./customers-api";

// URL param names (also the API's filter param names) + the default sort.
export const CUSTOMER_FILTER_KEYS = ["search", "city", "salesExecutiveId", "dues"] as const;
export const CUSTOMER_SORT: SortingState = [{ id: "legalName", desc: false }];

export const ALL = "__all"; // Select needs a non-empty sentinel for the "all" option.
export const DUES_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All dues" },
  { value: "owes", label: "Owes" },
  { value: "credit", label: "In credit" },
  { value: "settled", label: "Settled" },
];

export type CustomersRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export interface CustomerFilters {
  search: string;
  city: string;
  salesExecutiveId: string;
  dues: string;
}

/** A one-line summary of the active filters for the PDF header. */
export function buildFilterCaption(
  filters: CustomerFilters,
  salesExecutives: { id: string; name: string }[],
): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  if (filters.city) parts.push(`City: ${filters.city}`);
  if (filters.salesExecutiveId) {
    const name = salesExecutives.find((s) => s.id === filters.salesExecutiveId)?.name;
    parts.push(`Executive: ${name ?? filters.salesExecutiveId}`);
  }
  if (filters.dues) {
    parts.push(`Dues: ${DUES_OPTIONS.find((d) => d.value === filters.dues)?.label ?? filters.dues}`);
  }
  return parts.length ? `Filters — ${parts.join(" · ")}` : "All customers";
}

/** Build the shared query string for the download (every filter + sort, page 100). */
export function buildDownloadParams(
  filters: CustomerFilters,
  sort: { id: string; desc: boolean } | undefined,
): URLSearchParams {
  const base = new URLSearchParams();
  if (filters.search) base.set("search", filters.search);
  if (filters.city) base.set("city", filters.city);
  if (filters.salesExecutiveId) base.set("salesExecutiveId", filters.salesExecutiveId);
  if (filters.dues) base.set("dues", filters.dues);
  if (sort) {
    base.set("sort", sort.id);
    base.set("dir", sort.desc ? "desc" : "asc");
  }
  base.set("pageSize", "100"); // server caps pageSize at 100 — paginate to gather all.
  return base;
}

/** Page through every matching customer using `fetchPage`, gathering all rows. */
export async function collectAllCustomers(
  fetchPage: (page: number) => Promise<{ customers: Customer[]; total: number }>,
): Promise<Customer[]> {
  const all: Customer[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchPage(page);
    all.push(...res.customers);
    if (all.length >= res.total || res.customers.length === 0) break;
  }
  return all;
}
