"use client";

import { formatDate } from "@/lib/format";
import { FulfillmentBadge, InvoiceCell } from "@/features/orders/orders-columns";
import type { Order } from "@/features/orders/orders-api";

export function RowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      {[16, 24, 24, 20, 12, 16].map((w, i) => (
        <td key={i} className={`px-5 py-3.5 ${i >= 4 ? "text-right" : ""}`}>
          <span
            className="inline-block h-4 animate-pulse rounded bg-slate-200"
            style={{ width: `${w * 4}px` }}
          />
        </td>
      ))}
    </tr>
  );
}

/** One order row; clicking anywhere opens the order detail page. */
export function OrderRow({ order, onOpen }: { readonly order: Order; readonly onOpen: (id: string) => void }) {
  return (
    <tr
      onClick={() => onOpen(order.id)}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-primary/5"
    >
      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary">{order.orderCode}</td>
      <td className="px-5 py-3.5">
        <InvoiceCell invoices={order.invoices} />
      </td>
      <td className="px-5 py-3.5 text-muted-foreground">{formatDate(order.orderDate)}</td>
      <td className="px-5 py-3.5 text-muted-foreground">{order.salesExecutiveName ?? "—"}</td>
      <td className="px-5 py-3.5 text-right">
        {order.totalLitres != null ? `${order.totalLitres} L` : "—"}
      </td>
      <td className="px-5 py-3.5 text-right">
        <FulfillmentBadge status={order.fulfillmentStatus} />
      </td>
    </tr>
  );
}
