"use client";

import type { BeatCustomer } from "./beat-plans-api";

/** Compute the four header figures for a beat plan. */
export function beatStats(customers: BeatCustomer[]): { n: number | string; l: string }[] {
  const assigned = customers.filter((c) => c.weekday != null).length;
  return [
    { n: customers.length, l: "Customers" },
    { n: assigned, l: "Assigned" },
    { n: customers.length - assigned, l: "Unassigned" },
    { n: assigned ? (assigned / 6).toFixed(1) : "0", l: "Avg / day" },
  ];
}

/** The customers / assigned / unassigned / avg-per-day stat strip. */
export function BeatStats({ customers }: { readonly customers: BeatCustomer[] }) {
  const stats = beatStats(customers);
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {stats.map((s, i) => (
        <div key={s.l} className={`px-4 py-1.5 text-center ${i < stats.length - 1 ? "border-r border-border" : ""}`}>
          <div className="text-base font-bold tabular-nums text-foreground">{s.n}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
        </div>
      ))}
    </div>
  );
}
