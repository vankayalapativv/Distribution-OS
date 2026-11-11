import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

export interface MarketNoteItem {
  id: string;
  category: string;
  competitorBrand: string | null;
  product: string | null;
  price: number | null;
  details: string;
}

export interface MarketNote {
  id: string;
  meetingDate: string;
  seUserId: string;
  seName: string | null;
  customerId: string | null;
  customerName: string | null;
  note: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  items: MarketNoteItem[];
}

export interface MarketPhoto {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  uploadedByName: string | null;
  createdAt: string;
}

export interface SalesExecutive {
  id: string;
  name: string;
}

export interface CustomerLite {
  id: string;
  legalName: string;
  customerCode: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}


async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listMarketNotes(): Promise<MarketNote[]> {
  const response = await fetchApi("/market-intelligence/notes");
  if (!response.ok) throw new Error(`Market intelligence API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ notes: MarketNote[] }>;
  return body.data.notes;
}

export async function listMarketPhotos(): Promise<MarketPhoto[]> {
  const response = await fetchApi("/market-intelligence/photos");
  if (!response.ok) throw new Error(`Market intelligence API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ photos: MarketPhoto[] }>;
  return body.data.photos;
}

export async function listSalesExecutives(): Promise<SalesExecutive[]> {
  const response = await fetchApi("/orders/sales-executives");
  if (!response.ok) throw new Error(`Sales executives API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ salesExecutives: SalesExecutive[] }>;
  return body.data.salesExecutives;
}

export async function listCustomersLite(): Promise<CustomerLite[]> {
  const response = await fetchApi("/customers");
  if (!response.ok) throw new Error(`Customers API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<
    { id: string; legalName: string; customerCode: string }[]
  >;
  return body.data.map((c) => ({
    id: c.id,
    legalName: c.legalName,
    customerCode: c.customerCode,
  }));
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
