import { rupeesExact, formatTime, formatDayMonth } from "@/lib/format";
import { litresLabel, type CustomerRow, type MetricKey } from "./metrics-helpers";
import { CustomerName, StatusChip } from "./customer-row-parts";

const ROW = "flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0";

/** The right-hand sub-line under an order's value, which differs per metric. */
function orderSubline(metric: MetricKey, r: CustomerRow): string {
  if (metric === "ordered") {
    const n = Number(r.oilLines ?? 0);
    return `${n} item${n === 1 ? "" : "s"}`;
  }
  const returnedLitres = Number(r.returnedLitres ?? 0);
  return returnedLitres > 0 ? `− ${litresLabel(returnedLitres)} returned` : "delivered";
}

/** Litres / ordered: one order line with value + per-metric sub-line. */
export function OrderRow({ metric, row: r }: Readonly<{ metric: MetricKey; row: CustomerRow }>) {
  const litres = Number(r.litres ?? 0);
  const cancelled = metric === "ordered" && r.orderStatus === "cancelled";
  return (
    <div className={ROW}>
      <span className="min-w-0 flex-1">
        <CustomerName row={r} />
        <span className="block text-xs text-muted-foreground">
          {String(r.orderCode)} · {formatDayMonth(String(r.date))} · {formatTime(r.createdAt as string)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {cancelled ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Cancelled</span>
        ) : null}
        <span className="text-right">
          <span className="block text-sm font-bold tabular-nums text-foreground">
            {litresLabel(litres)}
          </span>
          <span className="block text-[11px] text-muted-foreground">{orderSubline(metric, r)}</span>
        </span>
      </span>
    </div>
  );
}

/** Collections: one payment with mode/date + amount + verification status. */
export function CollectionRow({ row: r }: { readonly row: CustomerRow }) {
  return (
    <div className={ROW}>
      <span className="min-w-0 flex-1">
        <CustomerName row={r} />
        <span className="block text-xs text-muted-foreground">
          {String(r.paymentMode)} · {formatDayMonth(String(r.date))} · {formatTime(r.createdAt as string)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums text-foreground">{rupeesExact(Number(r.amount ?? 0))}</span>
        <StatusChip status={String(r.status)} />
      </span>
    </div>
  );
}
