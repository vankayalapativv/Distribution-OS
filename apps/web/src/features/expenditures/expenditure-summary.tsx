"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { ExpenditureSummary } from "./expenditures-api";
import { ExpenditureSummaryCards } from "./expenditure-summary-cards";

/**
 * Recharts is heavy, so the donut only downloads when this page renders —
 * same code-splitting rule as the date pickers (see apps/web/AGENTS.md).
 */
const BreakdownChart = dynamic(() => import("./expenditure-breakdown-chart"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto aspect-square max-h-[320px] w-full rounded-lg" />,
});

/** Period totals, the compulsory/variable split, and a per-category breakdown. */
export function ExpenditureSummaryPanel({
  actionConfig,
  from,
  to,
}: {
  readonly actionConfig: ActionConfig;
  readonly from: string;
  readonly to: string;
}) {
  const query = useQuery({
    queryKey: ["expenditure-summary", from, to],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      return apiGet<ExpenditureSummary>(actionConfig, `/expenditures/summary?${sp.toString()}`);
    },
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <ExpenditureSummaryCards data={data} />

      {data.categories.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold">Breakdown by category</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Blue = compulsory, grey = variable. Hover a slice for its amount and share.
            </p>
          </div>
          <div className="p-4">
            <BreakdownChart summary={data} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
