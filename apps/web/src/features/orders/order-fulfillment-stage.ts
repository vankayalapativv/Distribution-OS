import type { OrderDetail, Shipment } from "./orders-api";

export type FulfillmentStage =
  | "ordered"
  | "partially_invoiced"
  | "invoiced"
  | "partially_delivered"
  | "delivered"
  | "partially_returned"
  | "returned"
  | "partially_cancelled";

/** Per-stage subtle card tint + matching current-stage badge colour. */
export const STAGE_STYLES: Record<FulfillmentStage, { card: string; badge: string; label: string }> = {
  ordered: { card: "border-blue-100 bg-blue-50/60", badge: "bg-blue-100 text-blue-700", label: "Ordered" },
  partially_invoiced: { card: "border-indigo-100 bg-indigo-50/60", badge: "bg-indigo-100 text-indigo-700", label: "Partially invoiced" },
  invoiced: { card: "border-blue-100 bg-blue-50/60", badge: "bg-blue-100 text-blue-700", label: "Invoiced" },
  partially_delivered: { card: "border-amber-100 bg-amber-50/60", badge: "bg-amber-100 text-amber-800", label: "Partially delivered" },
  delivered: { card: "border-green-100 bg-green-50/60", badge: "bg-green-100 text-green-700", label: "Delivered" },
  partially_returned: { card: "border-orange-100 bg-orange-50/60", badge: "bg-orange-100 text-orange-700", label: "Partially returned" },
  returned: { card: "border-rose-100 bg-rose-50/60", badge: "bg-rose-100 text-rose-700", label: "Returned" },
  partially_cancelled: { card: "border-purple-100 bg-purple-50/60", badge: "bg-purple-100 text-purple-700", label: "Partially cancelled" },
};

/** Derive the order's fulfillment stage from its shipments + per-SKU remaining.
 *  Mirrors the server's FULFILLMENT_CASE: a short-close (any line has a cancelled
 *  remainder) takes precedence and replaces the stage → partially_cancelled; then
 *  returns take precedence over the invoice/delivery ladder — fully returned →
 *  returned; some units returned → partially_returned; else invoiced (something
 *  billed) but with SKUs still to bill and nothing delivered → partially_invoiced. */
export function deriveStage(shipments: Shipment[], skuProgress: OrderDetail["skuProgress"]): FulfillmentStage {
  if (skuProgress.some((p) => (p.cancelledUnits ?? 0) > 0)) return "partially_cancelled";
  const returnedUnits = skuProgress.reduce((sum, p) => sum + (p.returnedUnits ?? 0), 0);
  if (returnedUnits > 0) {
    const allBilledReturned = skuProgress.every((p) => p.invoicedUnits - (p.returnedUnits ?? 0) <= 0.001);
    return allBilledReturned ? "returned" : "partially_returned";
  }
  if (shipments.length === 0) return "ordered";
  const anyRemaining = skuProgress.some((p) => p.remainingUnits > 0);
  const anyDelivered = shipments.some((s) => s.delivered);
  const allDelivered = shipments.every((s) => s.delivered);
  if (allDelivered && !anyRemaining) return "delivered";
  if (anyDelivered) return "partially_delivered";
  if (anyRemaining) return "partially_invoiced";
  return "invoiced";
}
