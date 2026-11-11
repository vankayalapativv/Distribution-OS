"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Order } from "@/features/orders/orders-api";
import type { ActionConfig } from "@/lib/api-client";
import { CustomerNewOrderButton } from "./customer-new-order-button";
import { OrderRow, RowSkeleton } from "./customer-orders-rows";

/** Orders tab: the customer's latest 5 orders + a "View all" link to the full list. */
export function CustomerOrdersTab({
  orders,
  total,
  isLoading,
  customerId,
  customerName,
  actionConfig,
  canCreateOrder,
}: {
  readonly orders: Order[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly customerId: string;
  readonly customerName: string;
  readonly actionConfig: ActionConfig;
  /** SUPER_ADMIN / MANAGER only — matches the Orders page create permission. */
  readonly canCreateOrder: boolean;
}) {
  const router = useRouter();

  const newOrderButton = canCreateOrder ? (
    <CustomerNewOrderButton
      customerId={customerId}
      customerName={customerName}
      actionConfig={actionConfig}
    />
  ) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pb-3.5 pt-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Orders
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Latest 5 · newest first</p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 ? (
            <Link
              href={`/orders?customerId=${customerId}`}
              className="whitespace-nowrap text-sm font-semibold text-primary hover:underline"
            >
              View all {total} order{total === 1 ? "" : "s"} →
            </Link>
          ) : null}
          {newOrderButton}
        </div>
      </div>

      {!isLoading && orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-border px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">No orders yet for this customer.</p>
          {newOrderButton}
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Code</th>
              <th className="px-5 py-2.5 font-medium">Invoice</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Sales Exec</th>
              <th className="px-5 py-2.5 text-right font-medium">Litres</th>
              <th className="px-5 py-2.5 text-right font-medium">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)
              : orders.map((o) => (
                  <OrderRow key={o.id} order={o} onOpen={(id) => router.push(`/orders/${id}`)} />
                ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
