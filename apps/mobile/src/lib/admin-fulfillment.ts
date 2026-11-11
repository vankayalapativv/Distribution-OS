import { apiFetch } from "./api";
import { useAuth } from "./auth";

/**
 * Order-fulfillment funnel counts — mirrors the web `/orders/fulfillment-summary`
 * payload (services/orders `orderFulfillmentSummary`). All-time snapshot across
 * every order; takes no date range (matches the web Orders-page summary).
 */
export interface FulfillmentSummary {
  ordered: number;
  partiallyInvoiced: number;
  invoiced: number;
  partiallyDelivered: number;
  delivered: number;
  partiallyReturned: number;
  returned: number;
  cancelled: number;
}

export async function fetchFulfillmentSummary(): Promise<FulfillmentSummary> {
  const token = useAuth.getState().token;
  const res = await apiFetch<{ summary: FulfillmentSummary }>("/orders/fulfillment-summary", {
    token,
  });
  return res.summary;
}
