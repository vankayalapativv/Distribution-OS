"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { plural } from "@/lib/format";

/** The Orders page header: crumbs + title + a live order-count subtitle, and the
 *  New-Order button (SA/Manager). */
export function OrdersListHeader({
  canCreate,
  onNewOrder,
  total,
  isLoading,
}: {
  readonly canCreate: boolean;
  readonly onNewOrder: () => void;
  readonly total: number;
  readonly isLoading: boolean;
}) {
  return (
    <PageHeader
      crumbs={[{ label: "Management" }, { label: "Orders" }]}
      title="Orders"
      subtitle={isLoading ? "Loading…" : `${total} order${plural(total)} in your organisation`}
      action={canCreate ? <Button onClick={onNewOrder}>+ New Order</Button> : undefined}
    />
  );
}
