import { apiFetch } from "./api";
import { useAuth } from "./auth";
import type { DuesBucketKey, DuesSummary } from "./dues";

/** A customer in a master dues bucket, tagged with its owning SE. */
export interface AdminDuesCustomer {
  customerId: string;
  customerName: string;
  executiveName: string;
  oldestInvoiceDate: string;
  ageDays: number;
  outstanding: number;
}

export interface SalesExec {
  id: string;
  name: string;
}

/** One SE's total collection dues (SA Home "Dues by executive" card). */
export interface SeDues {
  executiveId: string;
  executiveName: string;
  customerCount: number;
  totalOutstanding: number;
}

const token = () => useAuth.getState().token;

/** Total dues per SE (only SEs carrying dues), ranked highest-first. */
export async function fetchDuesByExecutive(): Promise<SeDues[]> {
  const data = await apiFetch<{ executives: SeDues[] }>("/dues/by-executive", { token: token() });
  return data.executives ?? [];
}

/** Master dues summary across ALL customers (optionally one SE). */
export function fetchAdminDuesSummary(executiveId?: string | null): Promise<DuesSummary> {
  const q = executiveId ? `?executiveId=${executiveId}` : "";
  return apiFetch<DuesSummary>(`/dues/summary${q}`, { token: token() });
}

/** Customers in one master bucket (optionally one SE). */
export function fetchAdminDuesCustomers(
  bucket: DuesBucketKey,
  executiveId?: string | null,
): Promise<{ bucket: DuesBucketKey; customers: AdminDuesCustomer[] }> {
  const q = executiveId ? `&executiveId=${executiveId}` : "";
  return apiFetch(`/dues/customers?bucket=${bucket}${q}`, { token: token() });
}

/** Active sales executives, for the master-dues SE filter. */
export async function fetchSalesExecutives(): Promise<SalesExec[]> {
  const data = await apiFetch<{ salesExecutives: SalesExec[] }>("/orders/sales-executives", {
    token: token(),
  });
  return data.salesExecutives ?? [];
}
