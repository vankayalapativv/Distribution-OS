import { Badge } from "@/components/ui/badge";
import { formatDateTime, litres as fmtLitres } from "@/lib/format";
import type { Shipment } from "./orders-api";

/** One invoiced shipment in the fulfillment timeline: code, contents, delivery state. */
export function ShipmentCard({ s }: Readonly<{ s: Shipment }>) {
  const parts = [
    s.oilLitres > 0 ? `${fmtLitres(s.oilLitres)} L oils` : null,
  ].filter(Boolean);
  if (s.cancelled) {
    return (
      <div className="opacity-70">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Invoice cancelled</span>
          <span className="font-mono text-xs text-muted-foreground line-through">{s.code}</span>
          <Badge variant="outline" className="border-transparent bg-slate-200 text-slate-600">
            Cancelled
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(s.invoicedAt)}
          {parts.length > 0 ? ` · ${parts.join(" · ")}` : ""} · stock returned
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Invoiced</span>
        <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
        {s.delivered ? (
          <Badge variant="outline" className="border-transparent bg-green-100 text-green-700">
            Delivered
          </Badge>
        ) : (
          <Badge variant="outline" className="border-transparent bg-slate-100 text-slate-600">
            Not delivered
          </Badge>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatDateTime(s.invoicedAt)}
        {parts.length > 0 ? ` · ${parts.join(" · ")}` : ""}
      </p>
      {s.delivered && s.deliveredAt ? (
        <p className="mt-0.5 text-xs text-green-700">Delivered {formatDateTime(s.deliveredAt)}</p>
      ) : null}
    </div>
  );
}
