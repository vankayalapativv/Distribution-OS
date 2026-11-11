"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { OrdersCreateDialog } from "@/features/orders/orders-create-dialog";
import type { Product, SalesExecutive } from "@/features/orders/orders-api";

/**
 * "New Order" button on a customer's page — opens the standard New-Order dialog
 * with THIS customer locked in. The dialog's catalogue data (products, sales
 * execs) is fetched lazily on first open so it never slows the customer page.
 * On success we refetch the customer's order list + count.
 */
export function CustomerNewOrderButton({
  customerId,
  customerName,
  actionConfig,
  variant = "default",
}: Readonly<{
  customerId: string;
  customerName: string;
  actionConfig: ActionConfig;
  /** Button style — the Orders tab uses the primary default; the ledger uses outline. */
  variant?: "default" | "outline";
}>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // `loaded` stays true after the first open so the data isn't refetched on reopen.
  const [loaded, setLoaded] = useState(false);

  const products = useQuery({
    queryKey: ["order-products"],
    queryFn: () => apiGet<{ products: Product[] }>(actionConfig, "/orders/products"),
    enabled: loaded,
    staleTime: 5 * 60_000,
  });
  const salesExecs = useQuery({
    queryKey: ["order-sales-execs"],
    queryFn: () =>
      apiGet<{ salesExecutives: SalesExecutive[] }>(actionConfig, "/orders/sales-executives"),
    enabled: loaded,
    staleTime: 5 * 60_000,
  });

  const ready = products.data && salesExecs.data;
  const pending = open && !ready;

  function handleOpen() {
    setLoaded(true);
    setOpen(true);
  }

  return (
    <>
      <Button size="sm" variant={variant} onClick={handleOpen} disabled={pending}>
        {pending ? "Loading…" : "+ New Order"}
      </Button>

      {ready ? (
        <OrdersCreateDialog
          open={open}
          onOpenChange={setOpen}
          products={products.data.products}
          customers={[{ id: customerId, legalName: customerName, addressCity: null }]}
          salesExecutives={salesExecs.data.salesExecutives}
          actionConfig={actionConfig}
          initialCustomerId={customerId}
          lockCustomer
          lockedCustomerLabel={customerName}
          onCreated={() =>
            void queryClient.invalidateQueries({ queryKey: ["customer-orders", customerId] })
          }
        />
      ) : null}
    </>
  );
}
