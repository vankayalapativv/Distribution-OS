"use client";

import { rupeesExact } from "@/lib/format";
import type { ExpenditureSummary } from "./expenditures-api";

function Card({ label, value, hint, tone }: { readonly label: string; readonly value: string; readonly hint?: string; readonly tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The four period stat cards: total, compulsory, variable, categories used. */
export function ExpenditureSummaryCards({ data }: { readonly data: ExpenditureSummary }) {
  const pct = (n: number) => (data.total > 0 ? Math.round((n / data.total) * 100) : 0);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card label="Total spend" value={rupeesExact(data.total)} hint={`${data.entries} entries`} />
      <Card label="Compulsory" value={rupeesExact(data.compulsory)} hint={`${pct(data.compulsory)}% of total`} tone="text-blue-700" />
      <Card label="Variable" value={rupeesExact(data.variable)} hint={`${pct(data.variable)}% of total`} tone="text-slate-700" />
      <Card label="Categories used" value={String(data.categories.length)} hint="in this period" />
    </div>
  );
}
