"use client";

import { CalendarIcon } from "lucide-react";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shimmer } from "@/components/ui/shimmer";
import { type ActionConfig } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CustomerVisitsTable } from "./customer-visits-table";
import { useCustomerVisits } from "./use-customer-visits";
import { TILES, durationLabel, roleProductivityPct } from "./customer-visits-logic";

/** "60%" or "—" for a role's productivity. */
const pctLabel = (pct: number | null): string => (pct == null ? "—" : `${pct}%`);

export function CustomerVisitsTab({
  customerId,
  actionConfig,
}: Readonly<{
  customerId: string;
  actionConfig: ActionConfig;
}>) {
  const v = useCustomerVisits(customerId, actionConfig);

  let visitCountLabel = "…";
  if (v.data) {
    visitCountLabel = `${v.data.total} visit${v.data.total === 1 ? "" : "s"}`;
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => v.applyPreset(t.key)}
            className={cn(
              "rounded-xl border bg-white p-4 text-left shadow-sm transition-colors",
              v.preset === t.key ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
            {v.data ? (
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{v.summary[t.pick]}</p>
            ) : (
              <Shimmer className="mt-1.5 h-7 w-12" />
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">check-ins</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {visitCountLabel}
          {v.preset === "custom" && v.range.from ? ` · ${v.range.from} to ${v.range.to}` : ""}
        </p>
        <div className="flex items-center gap-2">
          {v.data?.byRole ? (
            <span
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
              title="All-time average time spent per visit (manual check-outs only), by visitor role"
            >
              <span>Avg time</span>
              <span className="ml-1 tabular-nums">Exec {durationLabel(v.data.byRole.executive.avgDurationMinutes)}</span>
              <span className="mx-1 text-slate-400">·</span>
              <span className="tabular-nums">Admin {durationLabel(v.data.byRole.admin.avgDurationMinutes)}</span>
            </span>
          ) : null}
          {v.data?.byRole ? (
            <span
              className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              title="All-time productivity (visits that produced an order or collection), by visitor role"
            >
              <span>Productivity</span>
              <span className="ml-1 tabular-nums">Exec {pctLabel(roleProductivityPct(v.data.byRole.executive))}</span>
              <span className="mx-1 text-emerald-300">·</span>
              <span className="tabular-nums">Admin {pctLabel(roleProductivityPct(v.data.byRole.admin))}</span>
            </span>
          ) : null}
          <Popover open={v.calOpen} onOpenChange={v.onCalOpenChange}>
            <PopoverTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium transition-colors hover:bg-accent focus:outline-none">
              <CalendarIcon size={14} className="opacity-60" />
              {v.preset === "custom" && v.range.from ? `${v.range.from} – ${v.range.to}` : "Custom range"}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <LazyCalendar mode="range" onSelect={v.onCalendar} disabled={{ after: new Date() }} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <CustomerVisitsTable isLoading={v.query.isLoading} data={v.data} feed={v.feed} />

      {v.data && v.data.total > 8 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">Page {v.data.page} / {v.pageCount}</span>
          <button type="button" disabled={v.page <= 1} onClick={() => v.setPage((p) => p - 1)}
            className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent disabled:opacity-40">Prev</button>
          <button type="button" disabled={v.page >= v.pageCount} onClick={() => v.setPage((p) => p + 1)}
            className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}
