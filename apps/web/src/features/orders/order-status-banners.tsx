import type { OrderDetail } from "./orders-api";

/** Red banner for a fully cancelled order, with the reason if one was recorded. */
export function OrderCancelledBanner({ note }: { readonly note: string | null }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3">
      <p className="text-sm font-medium text-rose-800">Order cancelled</p>
      <p className="mt-0.5 text-sm text-rose-700">
        {note ? (
          <>
            <span className="text-rose-600">Reason: </span>
            {note}
          </>
        ) : (
          <span className="text-rose-600/80">No reason was recorded.</span>
        )}
      </p>
    </div>
  );
}

/** Purple banner for a short-closed order (un-invoiced remainder cancelled). */
export function OrderShortClosedBanner({ note }: { readonly note: string | null }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/70 px-4 py-3">
      <p className="text-sm font-medium text-purple-800">Order partially cancelled (short-closed)</p>
      <p className="mt-0.5 text-sm text-purple-700">
        The un-invoiced remainder was cancelled; invoiced items remain. The order was shrunk to what was
        fulfilled — the line table below shows the original ordered quantity alongside the cancelled amount.
        {note ? (
          <>
            {" "}
            <span className="text-purple-600">Reason: </span>
            {note}
          </>
        ) : null}
      </p>
    </div>
  );
}

/** True when the order was short-closed: not cancelled, but some line has a cancelled remainder. */
export function isShortClosed(order: OrderDetail): boolean {
  return order.orderStatus !== "cancelled" && (order.skuProgress ?? []).some((p) => (p.cancelledUnits ?? 0) > 0);
}
