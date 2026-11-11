import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { OrderDetail } from "./orders-api";
import { deriveStage, STAGE_STYLES } from "./order-fulfillment-stage";
import { ShipmentCard } from "./order-shipment-card";

/** One dot + connector node in the vertical timeline. */
function TimelineRow({ done, last, children }: { readonly done: boolean; readonly last: boolean; readonly children: React.ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "mt-0.5 size-3 shrink-0 rounded-full ring-2",
            done ? "bg-primary ring-primary/30" : "bg-white ring-border",
          )}
        />
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/** The order's fulfillment timeline: created → invoiced shipments → remaining/cancelled. */
export function FulfillmentTrail({ order }: { readonly order: OrderDetail }) {
  // Defensive defaults — older API responses / other code paths may omit these.
  const shipments = order.shipments ?? [];
  const skuProgress = order.skuProgress ?? [];
  const style = STAGE_STYLES[deriveStage(shipments, skuProgress)];
  const remaining = skuProgress.filter((p) => p.remainingUnits > 0);
  const cancelled = skuProgress.filter((p) => (p.cancelledUnits ?? 0) > 0);

  return (
    <div className={cn("rounded-lg border p-5", style.card)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fulfillment</h3>
        <Badge variant="outline" className={cn("border-transparent", style.badge)}>
          {style.label}
        </Badge>
      </div>

      <ol className="ml-1">
        <TimelineRow done last={false}>
          <p className="text-sm font-medium">Order created</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
        </TimelineRow>

        {shipments.length > 0 ? (
          shipments.map((s, i) => (
            <TimelineRow
              key={s.id}
              done
              last={i === shipments.length - 1 && remaining.length === 0 && cancelled.length === 0}
            >
              <ShipmentCard s={s} />
            </TimelineRow>
          ))
        ) : (
          <TimelineRow done={false} last={remaining.length === 0 && cancelled.length === 0}>
            <p className="text-sm text-muted-foreground">Not invoiced yet</p>
          </TimelineRow>
        )}

        {remaining.length > 0 ? (
          <TimelineRow done={false} last={cancelled.length === 0}>
            <p className="text-sm font-medium text-amber-800">
              Awaiting {remaining.length} SKU{remaining.length === 1 ? "" : "s"} to invoice
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {remaining.map((p) => `${p.label} (${p.remainingUnits} left)`).join(", ")}
            </p>
          </TimelineRow>
        ) : null}

        {cancelled.length > 0 ? (
          <TimelineRow done last>
            <p className="text-sm font-medium text-purple-800">
              Cancelled the un-invoiced remainder of {cancelled.length} SKU{cancelled.length === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cancelled.map((p) => `${p.label} (${p.cancelledUnits} cancelled)`).join(", ")}
            </p>
          </TimelineRow>
        ) : null}
      </ol>
    </div>
  );
}
