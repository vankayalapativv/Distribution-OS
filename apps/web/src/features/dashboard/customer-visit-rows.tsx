import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { rupeesExact, formatTime, formatDayMonth } from "@/lib/format";
import type { CustomerRow } from "./metrics-helpers";
import { CustomerName, chipClass, orderMetric, type VisitCollection, type VisitOrder } from "./customer-row-parts";

const ROW = "border-b border-border/50 px-3 py-2.5 last:border-b-0";

/** Executives metric: one row per tracked day (date + session window + visits). */
export function ExecutiveDayRow({ row: r }: { readonly row: CustomerRow }) {
  return (
    <div className={`flex items-center gap-3 ${ROW}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{formatDayMonth(String(r.date))}</span>
        <span className="block text-xs text-muted-foreground">
          started {formatTime(r.startedAt as string)} · last ping {formatTime(r.lastPingAt as string)}
        </span>
      </span>
      <span className="text-sm font-bold tabular-nums text-foreground">{String(r.visits)} visits</span>
    </div>
  );
}

/** Visits / productive / productivity: a check-in with planned flag + outcomes. */
export function VisitRow({ row: r }: { readonly row: CustomerRow }) {
  const isPlanned = String(r.planned ?? "") === "planned";
  const orders = (Array.isArray(r.orders) ? r.orders : []) as VisitOrder[];
  const collections = (Array.isArray(r.collections) ? r.collections : []) as VisitCollection[];
  const hasOutcome = orders.length > 0 || collections.length > 0;
  return (
    <div className={`flex flex-col gap-2 ${ROW}`}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <CustomerName row={r} />
          <span className="block text-xs text-muted-foreground">
            {formatDayMonth(String(r.date))} · in {formatTime(r.checkInAt as string)}
            {r.checkOutAt ? ` · out ${formatTime(r.checkOutAt as string)}` : ""}
          </span>
        </span>
        <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${isPlanned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {isPlanned ? "Planned" : "Unplanned"}
        </span>
      </div>
      {hasOutcome ? (
        <div className="flex flex-wrap gap-1.5">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className={chipClass}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order</span>
              <span className="font-mono text-[11px] font-semibold text-primary">{o.code}</span>
              <span className="tabular-nums text-foreground">{orderMetric(o)}</span>
              <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.id}`} className={chipClass}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Collection</span>
              <span className="font-mono text-[11px] font-semibold text-primary">{c.code}</span>
              <span className="tabular-nums text-foreground">{rupeesExact(c.amount)}</span>
              <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/70">— No order or collection</span>
      )}
    </div>
  );
}
