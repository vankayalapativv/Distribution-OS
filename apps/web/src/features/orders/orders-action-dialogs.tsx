"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { OrdersDialogs } from "./use-orders-dialogs";

/** Cancel (short-close) confirm + the "invoice generated" toast. All driven by
 *  the shared useOrdersDialogs state. */
export function OrdersActionDialogs({
  dialogs,
  canCreate,
}: {
  readonly dialogs: OrdersDialogs;
  readonly canCreate: boolean;
}) {
  const { canceling, generatedMsg } = dialogs;
  const partial = canceling ? (canceling.invoices?.length ?? 0) > 0 : false;
  return (
    <>
      {canCreate && (
        <ConfirmDialog
          open={canceling !== null}
          onOpenChange={(o) => {
            if (!o) {
              dialogs.setCanceling(null);
              dialogs.setCancelNote("");
            }
          }}
          title="Cancel this order?"
          description={
            partial
              ? "Only the un-invoiced remainder will be cancelled (short-closed). Anything already invoiced stays, and the order moves to Partially cancelled."
              : "The order will be marked Cancelled. You can still see it in the list."
          }
          details={
            canceling ? (
              <p>
                <span className="font-mono text-xs">{canceling.orderCode}</span>
                <span className="text-muted-foreground"> · {canceling.customerName ?? "—"}</span>
              </p>
            ) : null
          }
          extra={
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Reason for cancelling <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Textarea
                value={dialogs.cancelNote}
                onChange={(e) => dialogs.setCancelNote(e.target.value)}
                placeholder="e.g. Customer changed their mind, duplicate order…"
                className="mt-2"
                rows={3}
              />
            </label>
          }
          confirmLabel={partial ? "Cancel remainder" : "Cancel order"}
          onConfirm={() => dialogs.doCancel(canceling!)}
        />
      )}
      {generatedMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-green-600 px-4 py-2.5 text-sm text-white shadow-lg">
          {generatedMsg}
          <button className="ml-3 opacity-80 hover:opacity-100" onClick={() => dialogs.setGeneratedMsg(null)}>✕</button>
        </div>
      )}
    </>
  );
}
