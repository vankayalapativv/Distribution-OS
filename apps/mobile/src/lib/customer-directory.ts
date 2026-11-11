/**
 * SE customer directory — online-only. The `/customers` API is already scoped
 * to a SALES_EXECUTIVE's own customers (created_by = self, decided 2026-07-10),
 * so this only ever returns the SE's own customers. Shared by the Customers tab
 * and the reminder customer picker so both see the same SE-scoped list. The
 * whole directory is loaded in ONE fetch and filtered client-side; no offline
 * cache (the A–Z contacts list needs the full set at this app's scale).
 */
import { apiFetch } from "./api";

export interface DirectoryCustomer {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  /** City/town alone (for the contacts-list row). */
  city: string | null;
}

interface ApiCustomer {
  id: string;
  customerCode: string;
  legalName: string;
  customerName: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function fetchSeCustomers(token: string | null): Promise<DirectoryCustomer[]> {
  const rows = await apiFetch<ApiCustomer[]>("/customers", { token });
  return rows.map((c) => ({
    id: c.id,
    code: c.customerCode,
    name: c.legalName || c.customerName || "Customer",
    phone: c.phone,
    address: [c.addressStreet, c.addressCity].filter(Boolean).join(", ") || null,
    city: c.addressCity,
  }));
}
