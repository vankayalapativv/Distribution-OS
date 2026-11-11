"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { OrderDetailItems } from "./order-detail-items";
import { FulfillmentTrail } from "./order-fulfillment-trail";
import { OrderCancelledBanner, OrderShortClosedBanner, isShortClosed } from "./order-status-banners";
import { orderActionFlags } from "./orders-list-helpers";
import type { OrderDetail } from "./orders-api";

export type OrderDetailRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

interface OrderDetailProps {
  readonly order: OrderDetail;
  readonly role: OrderDetailRole;
}

export function OrderDetailView({ order, role }: OrderDetailProps) {
  const router = useRouter();
  // Same gating as the list row's "Create Invoice": SUPER_ADMIN/ACCOUNTANT,
  // order still open (un-invoiced, non-cancelled, not delivered).
  const canCreateInvoice = orderActionFlags(order, {
    canCreate: role === "SUPER_ADMIN" || role === "MANAGER",
    canInvoice: role === "SUPER_ADMIN" || role === "ACCOUNTANT",
    invoiceGenerationEnabled: true,
  }).canGenerate;

  return (
    <DashboardShell role={role} active="orders">
      <PageHeader
        crumbs={[{ label: "Management" }, { label: "Orders", href: "/orders" }, { label: order.orderCode }]}
        title={order.orderCode}
        action={canCreateInvoice ? (
          <Button onClick={() => router.push(`/invoices/new?orderId=${order.id}`)}>
            <ReceiptText className="size-4" /> Create Invoice
          </Button>
        ) : undefined}
        subtitle={
          <>
            {order.customerId ? (
              <Link href={`/customers/${order.customerId}`} className="font-medium text-primary hover:underline">
                {order.customerName ?? "Unknown customer"}
              </Link>
            ) : (
              (order.customerName ?? "Unknown customer")
            )}
            {order.salesExecutiveName ? ` · SE: ${order.salesExecutiveName}` : ""}
          </>
        }
      />

      {order.orderStatus === "cancelled" && <OrderCancelledBanner note={order.cancellationNote} />}
      {isShortClosed(order) && <OrderShortClosedBanner note={order.cancellationNote} />}

      <FulfillmentTrail order={order} />
      <OrderDetailItems items={order.items} progress={order.skuProgress} />
    </DashboardShell>
  );
}
