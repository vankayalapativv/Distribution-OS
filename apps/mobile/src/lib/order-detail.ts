/**
 * Order-detail sheet data (online-only): fetch one order from the server; a
 * failure returns null so the sheet shows its retry state.
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { mapServerOrder, type OrderDetail, type ServerOrder } from "./order-detail-map";

export type { OrderDetail, OrderDetailItem } from "./order-detail-map";

/** Fetch one order's full breakdown from the server. Null on failure. */
export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const token = useAuth.getState().token;
  try {
    const data = await apiFetch<{ order: ServerOrder }>(`/orders/${orderId}`, { token });
    return mapServerOrder(data.order);
  } catch {
    return null;
  }
}
