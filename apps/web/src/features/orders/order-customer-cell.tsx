import { CUSTOMER_TYPE_LABELS, SegmentIcons } from "@/components/segment-icons";
import { formatPhone } from "./order-format-phone";
import type { Order } from "./orders-api";

/** Stacked customer identity for the orders table: name + segment icons on top,
 *  then "City · Executive · Type", then phone. Mirrors the Customers table cell. */
export function OrderCustomerCell({ order }: { readonly order: Order }) {
  const line2 = [
    order.addressCity,
    order.salesExecutiveName,
    order.customerType ? (CUSTOMER_TYPE_LABELS[order.customerType] ?? order.customerType) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const phone = formatPhone(order.customerPhone);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{order.customerName ?? "—"}</span>
        <SegmentIcons segment={order.segment} />
      </div>
      {line2 && <span className="text-xs text-muted-foreground">{line2}</span>}
      {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
    </div>
  );
}
