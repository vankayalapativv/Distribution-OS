/** Online-only fetchers + submit for the New Order flow (plain apiFetch, no cache). */
import { apiFetch } from "../api";
import type { CreditStatus, Product } from "./types";

export async function fetchOils(token: string | null): Promise<Product[]> {
  const data = await apiFetch<{ products: Product[] }>("/orders/products", { token });
  return data.products;
}

/** Credit gate — returns null on error (unknown; never blocks the order). */
export async function fetchCredit(
  customerId: string,
  token: string | null,
): Promise<CreditStatus | null> {
  try {
    const d = await apiFetch<CreditStatus>(`/customers/${customerId}/invoices`, { token });
    return {
      creditBlocked: d.creditBlocked,
      creditOverdueDays: d.creditOverdueDays,
      totalOutstanding: d.totalOutstanding,
    };
  } catch {
    return null;
  }
}

/** One order line — an oil product with pack size + segment. */
export interface OrderItemPayload {
  productId?: string;
  quantityUnits: number;
  packSizeLitres?: number | null;
  segment?: string | null;
}

/** POST /orders directly to the server. The `clientUuid` MUST be stable across
 *  retries — the server replays the same order (200 + `existing:true`) instead of
 *  creating a duplicate — so the caller owns it (a ref), never this function. The
 *  server defaults salesExecutiveId to the customer's owning SE — never sent. */
export async function submitOrder(
  token: string | null,
  input: { customerId: string; orderDate: string; items: OrderItemPayload[]; clientUuid: string },
): Promise<{ orderCode: string; existing?: boolean }> {
  const data = await apiFetch<{ order: { orderCode: string; existing?: boolean } }>("/orders", {
    method: "POST",
    token,
    body: input,
  });
  return data.order;
}
