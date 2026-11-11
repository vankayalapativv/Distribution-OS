import { formatDate } from "@/lib/format";
import type { Order, OrderItem } from "./orders-api";

/** Column headers for the orders export (PDF + Excel share these). */
export const HEAD = [
  "Order code", "Date", "Invoice ID", "Customer", "City", "Phone",
  "Sales Executive", "Fulfillment", "Products", "Qty / Litres",
];

export const FULFILLMENT_LABELS: Record<string, string> = {
  ordered: "Ordered",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  partially_returned: "Partially returned",
  returned: "Returned",
  partially_cancelled: "Partially cancelled",
  cancelled: "Cancelled",
};

const dash = (v: string | null | undefined) => (v?.trim() ? v : "—");

/** A line item's SKU label — oil name + pack. */
function skuLabel(it: OrderItem): string {
  if (it.productName) return it.packSizeLitres ? `${it.productName} ${it.packSizeLitres}L` : it.productName;
  return dash(it.productName);
}

/** The line's quantity — litres for oils, else pieces. */
function skuQty(it: OrderItem): string {
  if (it.totalLitres != null) return `${it.totalLitres.toLocaleString("en-IN")} L`;
  return it.quantityUnits.toLocaleString("en-IN");
}

/** One row per ORDER: its SKUs are comma-joined in Products, and their quantities
 *  comma-joined (same order) in Qty / Litres. An item-less order shows "—". */
export function buildRows(orders: Order[]): string[][] {
  return orders.map((o) => {
    const items = o.items ?? [];
    const skus = items.length ? items.map(skuLabel).join(", ") : "—";
    const qtys = items.length ? items.map(skuQty).join(", ") : "—";
    return [
      o.orderCode,
      formatDate(o.orderDate),
      dash(o.firstInvoiceNumber ?? o.invoiceCode),
      dash(o.customerName),
      dash(o.addressCity),
      dash(o.customerPhone),
      dash(o.salesExecutiveName),
      FULFILLMENT_LABELS[o.fulfillmentStatus ?? "ordered"] ?? dash(o.fulfillmentStatus),
      skus,
      qtys,
    ];
  });
}
