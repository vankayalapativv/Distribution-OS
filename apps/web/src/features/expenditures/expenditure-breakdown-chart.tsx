"use client";

import { useMemo, type ComponentProps } from "react";
import { Label, Pie, PieChart } from "recharts";
import type { TooltipValueType } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { rupeesExact } from "@/lib/format";
import type { ExpenditureSummary } from "./expenditures-api";
import { buildSlices } from "./breakdown-slices";

// Module scope: tooltip + center-label renderers bound to the current total via a
// factory, so they are not components redefined inside render (SonarQube S6478).
const makeTooltipFormatter = (total: number) =>
  function TooltipSliceValue(value: TooltipValueType, name: number | string) {
    return (
      <div className="flex w-full justify-between gap-4">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-medium tabular-nums">
          {rupeesExact(Number(value))}
          <span className="ml-1 text-muted-foreground">
            ({total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)
          </span>
        </span>
      </div>
    );
  };

type CenterLabelProps = { readonly viewBox?: { cx?: number; cy?: number } };
const makeCenterLabel = (total: number) =>
  function CenterLabel({ viewBox }: CenterLabelProps) {
    if (!viewBox || viewBox.cx == null || viewBox.cy == null) return null;
    return (
      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-semibold">
          {rupeesExact(total)}
        </tspan>
        <tspan x={viewBox.cx} y={viewBox.cy + 22} className="fill-muted-foreground text-xs">
          total spend
        </tspan>
      </text>
    );
  };

export default function ExpenditureBreakdownChart({
  summary,
}: {
  readonly summary: ExpenditureSummary;
}) {
  const slices = useMemo(() => buildSlices(summary.categories), [summary.categories]);

  const config = useMemo<ChartConfig>(() => {
    const entries: ChartConfig = {};
    for (const s of slices) entries[s.key] = { label: s.name, color: s.fill };
    return entries;
  }, [slices]);

  const tooltipFormatter = useMemo(() => makeTooltipFormatter(summary.total), [summary.total]);
  const centerLabel = useMemo(() => makeCenterLabel(summary.total), [summary.total]);

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[320px] w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              hideLabel
              formatter={tooltipFormatter as ComponentProps<typeof ChartTooltipContent>["formatter"]}
            />
          }
        />
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="name"
          innerRadius={78}
          outerRadius={118}
          paddingAngle={1}
          strokeWidth={2}
          // Recharts 3.8 + React 19: the entry animation never emits the
          // initial sector paths, leaving an empty chart. Disabling it renders.
          isAnimationActive={false}
        >
          <Label content={centerLabel as ComponentProps<typeof Label>["content"]} />
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="name" className="flex-wrap gap-x-4 gap-y-1" />}
        />
      </PieChart>
    </ChartContainer>
  );
}
