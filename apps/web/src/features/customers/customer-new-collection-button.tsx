"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { CollectionsCreateDialog } from "@/features/collections/collections-create-dialog";
import type { Collector } from "@/features/collections/collections-api";

/**
 * "New Collection" button on a customer's ledger — opens the standard
 * Record-Collection dialog with THIS customer locked in. The collectors list
 * (who received the payment) loads lazily on first open so it never slows the
 * customer page. On success we refetch the customer's ledger.
 */
export function CustomerNewCollectionButton({
  customerId,
  customerName,
  actionConfig,
  onCreated,
}: {
  readonly customerId: string;
  readonly customerName: string;
  readonly actionConfig: ActionConfig;
  readonly onCreated?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Stays true after the first open so collectors aren't refetched on reopen.
  const [loaded, setLoaded] = useState(false);

  const collectors = useQuery({
    queryKey: ["collection-collectors"],
    queryFn: () => apiGet<Collector[]>(actionConfig, "/collections/collectors"),
    enabled: loaded,
    staleTime: 5 * 60_000,
  });

  const ready = Boolean(collectors.data);
  const pending = open && !ready;

  function handleOpen() {
    setLoaded(true);
    setOpen(true);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen} disabled={pending}>
        {pending ? "Loading…" : "+ New Collection"}
      </Button>

      {ready ? (
        <CollectionsCreateDialog
          open={open}
          onOpenChange={setOpen}
          customers={[{ id: customerId, legalName: customerName, addressCity: null }]}
          collectors={collectors.data as Collector[]}
          actionConfig={actionConfig}
          initialCustomerId={customerId}
          lockedCustomerLabel={customerName}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ["customer-ledger", customerId] });
            onCreated?.();
          }}
        />
      ) : null}
    </>
  );
}
