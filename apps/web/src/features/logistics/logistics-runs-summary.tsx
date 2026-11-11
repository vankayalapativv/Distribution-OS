"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { RunsSummary } from "./logistics-run-types";

function StatCard({ label, value, sub, live }: { readonly label: string; readonly value: string; readonly sub: string; readonly live?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-white px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[22px] font-bold tabular-nums leading-none">
        {live && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500 align-middle ring-4 ring-green-500/15" />}
        {value}
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** Today's at-a-glance strip above the Runs table (runs / active / stops / distance). */
export function LogisticsRunsSummary({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const q = useQuery({
    queryKey: ["runs-summary"],
    queryFn: () => apiGet<RunsSummary>(actionConfig, "/logistics/runs-summary"),
  });
  const s = q.data;
  const n = (v?: number) => (v == null ? "—" : v.toLocaleString("en-IN"));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Runs today" value={n(s?.runsToday)} sub="across drivers" />
      <StatCard label="Active now" value={n(s?.activeNow)} sub="on the road" live />
      <StatCard label="Stops today" value={n(s?.stopsToday)} sub="customers delivered" />
      <StatCard label="Distance today" value={s?.distanceKm != null ? `${s.distanceKm} km` : "—"} sub="from odometer" />
    </div>
  );
}
