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

export interface CustomerPick {
  id: string;
  legalName: string;
  customerCode: string | null;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

/** Every customer (SA sees all) — the picker source for the reassign page. */
export async function listCustomersForPicker(): Promise<CustomerPick[]> {
  const res = await fetchApi("/customers");
  if (!res.ok) throw new Error(`Customers API failed with ${res.status}`);
  const body = (await res.json()) as ApiSuccess<
    { id: string; legalName: string; customerCode: string | null }[]
  >;
  return body.data.map((c) => ({
    id: c.id,
    legalName: c.legalName,
    customerCode: c.customerCode ?? null,
  }));
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
