"use client";

/** Stacked horizontal bar: one bar per sales executive, stacked by segment.
 *  Used by Sales-by-segment (litres) and Collections-by-segment (₹). Executives
 *  with zero total and segments empty across everyone are dropped. */
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { CATEGORICAL, ChartEmpty, RichTooltip } from "./reports-chart-kit";

interface SegRow {
  name: string;
  segments: Record<string, number>;
}

export function SegmentBarChart({
  segments,
  rows,
  fmt,
}: {
  readonly segments: string[];
  readonly rows: SegRow[];
  readonly fmt: (n: number) => string;
}) {
  const activeRows = rows.filter((r) => segments.reduce((s, seg) => s + (r.segments[seg] ?? 0), 0) > 0);
  const activeSegments = segments.filter((seg) => activeRows.some((r) => (r.segments[seg] ?? 0) > 0));
  if (activeRows.length === 0 || activeSegments.length === 0) return <ChartEmpty />;

  // Sanitised keys — segment names may contain spaces/symbols that break the
  // `--color-<key>` CSS var (e.g. "Gear Oil"). Config labels keep the real name.
  const keys = activeSegments.map((_, i) => `s${i}`);
  const config: ChartConfig = {};
  activeSegments.forEach((s, i) => {
    config[keys[i]] = { label: s, color: CATEGORICAL[i % CATEGORICAL.length] };
  });
  const data = activeRows.map((r) => {
    const o: Record<string, string | number> = { name: r.name };
    activeSegments.forEach((s, i) => {
      o[keys[i]] = r.segments[s] ?? 0;
    });
    return o;
  });
  const height = Math.max(240, activeRows.length * 46 + 64);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
        <ChartTooltip content={<RichTooltip config={config} fmt={fmt} withShare />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="a"
            fill={`var(--color-${k})`}
            radius={i === keys.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
