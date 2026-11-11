"use client";

import type { TargetPeriod } from "./targets-api";

/** Weekly / Monthly segmented switch. */
export function PeriodToggle({
  period,
  onChange,
}: {
  readonly period: TargetPeriod;
  readonly onChange: (p: TargetPeriod) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border p-0.5">
      {(["week", "month"] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p === "week" ? "Weekly" : "Monthly"}
        </button>
      ))}
    </div>
  );
}
