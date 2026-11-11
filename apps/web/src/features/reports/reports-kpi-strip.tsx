"use client";

/** Headline totals strip shown above the report cards. The six labels are
 *  constant, so the loading state (KpiStripSkeleton) keeps them as real text and
 *  shimmers only the numbers. */
import { type ReactNode } from "react";
import { litres, rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportsSummary } from "./reports-types";

const KPI_LABELS = [
  "Oil sold", "Collected", "Invoiced (pre-GST)", "Invoiced (with GST)",
  "Distance", "New customers", "Backlog", "Pending invoice",
];

function KpiGrid({ tiles }: { readonly tiles: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
          <div className="mt-1 text-lg font-semibold text-foreground">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export function KpiStrip({ m }: { readonly m: ReportsSummary }) {
  const values: string[] = [
    `${m.oilLitres === 0 ? "0" : litres(m.oilLitres)} L`,
    rupees(m.collected),
    rupees(m.invoicedPreGst),
    rupees(m.invoicedWithGst),
    `${Math.round(m.distanceKm)} km`,
    String(m.newCustomers),
    rupees(m.backlogValue),
    `${m.pendingOrders} orders`,
  ];
  return <KpiGrid tiles={KPI_LABELS.map((label, i) => ({ label, value: values[i] }))} />;
}

/** Loading state: real labels, value line shimmering. */
export function KpiStripSkeleton() {
  return (
    <KpiGrid tiles={KPI_LABELS.map((label) => ({ label, value: <Skeleton className="h-5 w-20" /> }))} />
  );
}
