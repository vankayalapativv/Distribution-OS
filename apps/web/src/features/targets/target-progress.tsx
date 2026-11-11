"use client";

import { litres as fmtLitres } from "@/lib/format";
import { OIL_SEGMENTS, segLitres, sumLitres, type PeriodProgress } from "./targets-api";
import { pctTextColor } from "./target-bar-colors";
import { Bar } from "./target-bar";
import { TargetOnly } from "./target-progress-only";

/** Per-segment oil bars for one SE + one period. When
 *  `targetOnly` (an upcoming period), show just the set targets — no actuals. */
export function TargetProgress({
  progress,
  targetOnly = false,
}: Readonly<{
  progress: PeriodProgress;
  targetOnly?: boolean;
}>) {
  const oilTotalActual = sumLitres(progress.oilActual);
  const oilTotalTarget = progress.oilTarget ? sumLitres(progress.oilTarget) : null;
  const oilTotalPct =
    oilTotalTarget !== null && oilTotalTarget > 0
      ? Math.round((oilTotalActual / oilTotalTarget) * 100)
      : null;

  if (targetOnly) return <TargetOnly progress={progress} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 lg:grid-cols-4">
        {OIL_SEGMENTS.map((segment) => (
          <Bar
            key={segment}
            label={segment}
            actual={segLitres(progress.oilActual, segment)}
            target={progress.oilTarget ? segLitres(progress.oilTarget, segment) : null}
            // "—" alone for zero (no stray unit); "50 L" otherwise.
            format={(v) => (v > 0 ? `${fmtLitres(v)} L` : "—")}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Oil total{" "}
        <span className="font-medium text-foreground">
          {oilTotalActual > 0 ? `${fmtLitres(oilTotalActual)} L` : "—"}
        </span>
        {oilTotalTarget !== null && oilTotalTarget > 0 ? ` / ${fmtLitres(oilTotalTarget)} L` : ""}
        {oilTotalPct !== null ? (
          <span className={`ml-1.5 font-semibold tabular-nums ${pctTextColor(oilTotalPct)}`}>{oilTotalPct}%</span>
        ) : null}
      </p>
    </div>
  );
}
