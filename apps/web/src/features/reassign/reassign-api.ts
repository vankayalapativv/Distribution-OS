import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

// Customer reassignment (SUPER_ADMIN, per-customer only). Server-side fetchers +
// the shapes returned by apps/api `customer-reassign` service.

export interface MovedCounts {
  orders: number;
  collections: number;
  invoices: number;
  visits: number;
  photos: number;
  notes: number;
  beatDays: number;
}

export interface ReassignHistoryEntry {
  id: string;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  assignedByName: string | null;
  createdAt: string;
  undoneAt: string | null;
  counts: MovedCounts;
}

export interface SalesExec {
  id: string;
  name: string;
}

export interface ReassignPreview {
  customer: { id: string; customerCode: string | null; legalName: string };
  currentOwner: { id: string; name: string } | null;
  counts: MovedCounts;
  undoable: ReassignHistoryEntry | null;
  history: ReassignHistoryEntry[];
  salesExecutives: SalesExec[];
}

/** One row of the browse-and-pick list: owner + record count per customer. */
export interface ReassignCustomerRow {
  id: string;
  legalName: string;
  customerCode: string | null;
  city: string | null;
  owner: { id: string; name: string } | null;
  recordCount: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Every customer with its current owner + record count — the reassign list. */
export async function listReassignCustomers(): Promise<ReassignCustomerRow[]> {
  const authHeaders = await getApiAuthHeaders();
  const res = await serverApiFetch("/customers/reassign/customers", {
    cache: "no-store",
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Reassign customers API failed with ${res.status}`);
  const body = (await res.json()) as ApiSuccess<ReassignCustomerRow[]>;
  return body.data;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
