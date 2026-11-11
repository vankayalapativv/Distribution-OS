"use client";

import { litres as fmtLitres } from "@/lib/format";
import { OIL_SEGMENTS, segLitres, sumLitres, type PeriodProgress } from "./targets-api";

/** Target-only view (upcoming periods): just the set target values, no actuals. */
export function TargetOnly({ progress }: Readonly<{ progress: PeriodProgress }>) {
  if (progress.oilTarget === null) {
    return <p className="text-sm text-muted-foreground">No target set for this period yet.</p>;
  }
  const oilTotalTarget = progress.oilTarget ? sumLitres(progress.oilTarget) : 0;
  const cell = (label: string, value: string) => (
    <div key={label} className="flex items-baseline justify-between gap-2">
      <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 lg:grid-cols-4">
        {OIL_SEGMENTS.map((segment) => {
          const t = progress.oilTarget ? segLitres(progress.oilTarget, segment) : 0;
          return cell(segment, t > 0 ? `${fmtLitres(t)} L` : "—");
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Oil total target{" "}
        <span className="font-medium text-foreground">
          {oilTotalTarget > 0 ? `${fmtLitres(oilTotalTarget)} L` : "—"}
        </span>
      </p>
    </div>
  );
}
