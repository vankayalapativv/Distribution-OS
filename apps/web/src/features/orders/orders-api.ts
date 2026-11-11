import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import type { Order, SalesExecutive } from "./order-types";
import type { OrderDetail } from "./order-detail-types";
import type { Product } from "./order-catalogue-types";

// Re-exported so existing `./orders-api` type imports keep resolving after the split.
export type { OrderInvoiceRef, OrderItem, SalesExecutive, Order } from "./order-types";
export type { OrderFulfillment, Shipment, SkuProgress, OrderDetail } from "./order-detail-types";
export type { Product } from "./order-catalogue-types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

async function fetchData<T>(path: string, label: string): Promise<T> {
  const response = await fetchApi(path);
  if (!response.ok) throw new Error(`${label} API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

export async function listOrders(params?: {
  status?: string;
  customerId?: string;
  salesExecutiveId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<Order[]> {
  const qs = new URLSearchParams();
  for (const key of ["status", "customerId", "salesExecutiveId", "dateFrom", "dateTo", "search"] as const) {
    const value = params?.[key];
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  const path = query ? `/orders?${query}` : "/orders";
  const { orders } = await fetchData<{ orders: Order[] }>(path, "Orders");
  return orders;
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return (await fetchData<{ order: OrderDetail }>(`/orders/${id}`, "Order")).order;
}

export async function listSalesExecutives(): Promise<SalesExecutive[]> {
  return (await fetchData<{ salesExecutives: SalesExecutive[] }>("/orders/sales-executives", "Sales executives")).salesExecutives;
}

export async function listProducts(): Promise<Product[]> {
  return (await fetchData<{ products: Product[] }>("/orders/products", "Products")).products;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return { apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1" };
}
