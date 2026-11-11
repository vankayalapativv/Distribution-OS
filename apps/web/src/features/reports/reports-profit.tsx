"use client";

/**
 * Profitability report detail — opened like any other report card, it uses the
 * Reports page's shared date range. Profit = sold (ex-GST) − expense share −
 * actual cost (COGS), rolled up by invoice / customer / SKU / area (generated
 * invoices only; expense share per unit = all period expenses ÷ units, 1 pc = 1 L).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { rupeesExact } from "@/lib/format";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { ReportRange } from "./reports-api";

type ProfitGroup = "invoice" | "customer" | "sku" | "area";

interface ProfitRow {
  key: string; label: string; sub: string | null;
  units: number; soldValue: number; cost: number; expenseValue: number; profit: number;
  marginPct: number | null; lines: number; unpricedLines: number;
}
interface ProfitTotals {
  invoices: number; units: number; soldValue: number; cost: number; expenseValue: number; expenses: number;
  profit: number; marginPct: number | null; expPerUnit: number; unpricedLines: number;
}
interface ProfitResult { groupBy: ProfitGroup; totals: ProfitTotals; rows: ProfitRow[] }

const TABS: { id: ProfitGroup; label: string }[] = [
  { id: "invoice", label: "By invoice" },
  { id: "customer", label: "By customer" },
  { id: "sku", label: "By SKU" },
  { id: "area", label: "By area" },
];

const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const profitTone = (n: number) => (n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-destructive" : "text-foreground");

function StatCard({ label, value, sub, tone }: Readonly<{ label: string; value: string; sub?: string; tone?: string }>) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${tone ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function ReportsProfitDetail({
  actionConfig, range, onBack,
}: Readonly<{ actionConfig: ActionConfig; range: ReportRange; onBack: () => void }>) {
  const [groupBy, setGroupBy] = useState<ProfitGroup>("invoice");

  const q = useQuery({
    queryKey: ["profit", range.from, range.to, groupBy],
    queryFn: () => apiGet<ProfitResult>(actionConfig, `/reports/profit?from=${range.from}&to=${range.to}&groupBy=${groupBy}`),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to,
  });
  const t = q.data?.totals;
  const rows = q.data?.rows ?? [];
  const loading = q.isLoading;

  const colLabel = useMemo(() => ({ invoice: "Invoice", customer: "Customer", sku: "Product", area: "Area" }[groupBy]), [groupBy]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ChevronLeft className="mr-1 size-4" /> All reports
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sold (ex-GST) − expense share − actual cost (COGS). Generated invoices only. Uses the date range above.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Profit" value={t ? rupeesExact(t.profit) : "—"} sub={t ? `${pct(t.marginPct)} margin` : undefined} tone={t ? profitTone(t.profit) : undefined} />
        <StatCard label="Sold (ex-GST)" value={t ? rupeesExact(t.soldValue) : "—"} sub={t ? `${t.invoices.toLocaleString("en-IN")} invoices` : undefined} />
        <StatCard label="Actual cost (COGS)" value={t ? rupeesExact(t.cost) : "—"} sub={t && t.unpricedLines > 0 ? `${t.unpricedLines} line(s) unpriced` : "per-batch rates"} tone={t && t.unpricedLines > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
        <StatCard label="Expenses" value={t ? rupeesExact(t.expenses) : "—"} sub={t ? `${rupeesExact(t.expPerUnit)} / unit · ${t.units.toLocaleString("en-IN")} units` : undefined} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" onClick={() => setGroupBy(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${groupBy === tab.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent"}`}
          >{tab.label}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">{colLabel}</th>
                <th className="px-3 py-2.5 text-right font-medium">Sold</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                <th className="px-3 py-2.5 text-right font-medium">Expenses</th>
                <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="px-4 py-2.5"><Skeleton className="h-4 w-44" /><Skeleton className="mt-1 h-3 w-24" /></td>
                  {Array.from({ length: 5 }).map((__, j) => <td key={j} className="px-3 py-2.5"><Skeleton className="ml-auto h-4 w-16" /></td>)}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No generated invoices in this period.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.label}</div>
                    {(r.sub || r.unpricedLines > 0) && (
                      <div className="text-xs text-muted-foreground">
                        {r.sub}{r.sub && r.unpricedLines > 0 ? " · " : ""}
                        {r.unpricedLines > 0 && <span className="text-amber-600 dark:text-amber-400">{r.unpricedLines} unpriced</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{rupeesExact(r.soldValue)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{rupeesExact(r.cost)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{rupeesExact(r.expenseValue)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${profitTone(r.profit)}`}>{rupeesExact(r.profit)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{pct(r.marginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
