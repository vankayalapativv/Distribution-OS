"use client";

import type { CustomerRow, MetricKey } from "./metrics-helpers";
import { CustomerSkeleton } from "./customer-skeleton";
import { ExecutiveDayRow, VisitRow } from "./customer-visit-rows";
import { CollectionRow, OrderRow } from "./customer-order-rows";

/** Second drill-down level: per-customer rows for one executive + metric. Each
 *  metric family renders its own row shape; dispatched here. */
export function CustomerLevel({ metric, rows }: Readonly<{ metric: MetricKey; rows: CustomerRow[] | null }>) {
  if (rows === null) return <CustomerSkeleton metric={metric} />;
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing recorded in this period.</p>;
  }
  return (
    <div>
      {rows.map((r) => {
        const key = rowKey(r);
        if (metric === "executives") return <ExecutiveDayRow key={key} row={r} />;
        if (metric === "visits" || metric === "productive" || metric === "productivity") {
          return <VisitRow key={key} row={r} />;
        }
        if (metric === "litres" || metric === "ordered") {
          return <OrderRow key={key} metric={metric} row={r} />;
        }
        return <CollectionRow key={key} row={r} />;
      })}
    </div>
  );
}

/** A stable key for a drill row from whichever id field it carries. */
function rowKey(r: CustomerRow): string {
  return String(r.customerId ?? r.orderCode ?? r.code ?? r.agentId ?? JSON.stringify(r));
}
