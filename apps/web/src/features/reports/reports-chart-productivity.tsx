"use client";

/** Productivity-% trend and visits trend — one line per executive across the
 *  last 6 months (visits adds a dashed Total line). */
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { CATEGORICAL, ChartEmpty, RichTooltip } from "./reports-chart-kit";
import type { ProductivityTrend, VisitsTrend } from "./reports-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? ym} ${y?.slice(2) ?? ""}`.trim();
}

export function ProductivityLineChart({ data }: { readonly data: ProductivityTrend }) {
  if (data.rows.length === 0) return <ChartEmpty />;
  const keys = data.rows.map((_, i) => `e${i}`);
  const config: ChartConfig = {};
  data.rows.forEach((r, i) => {
    config[keys[i]] = { label: r.name, color: CATEGORICAL[i % CATEGORICAL.length] };
  });
  const chartData = data.months.map((m) => {
    const o: Record<string, string | number | null> = { month: m };
    data.rows.forEach((r, i) => {
      o[keys[i]] = r.points.find((p) => p.month === m)?.pct ?? null;
    });
    return o;
  });
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <LineChart accessibilityLayer data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={(v) => `${v}%`} width={48} tickLine={false} axisLine={false} domain={[0, 100]} />
        <ChartTooltip content={<RichTooltip config={config} fmt={(n) => `${n}%`} labelFmt={monthLabel} hideTotal />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k) => (
          <Line key={k} type="monotone" dataKey={k} stroke={`var(--color-${k})`} strokeWidth={2} dot={false} connectNulls={false} />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function VisitsLineChart({ data }: { readonly data: VisitsTrend }) {
  if (data.rows.length === 0) return <ChartEmpty />;
  const keys = data.rows.map((_, i) => `e${i}`);
  const config: ChartConfig = {};
  data.rows.forEach((r, i) => {
    config[keys[i]] = { label: r.name, color: CATEGORICAL[i % CATEGORICAL.length] };
  });
  config.total = { label: "Total", color: "hsl(222 47% 25%)" };
  const chartData = data.months.map((m) => {
    const o: Record<string, string | number> = { month: m };
    data.rows.forEach((r, i) => {
      o[keys[i]] = r.points.find((p) => p.month === m)?.total ?? 0;
    });
    o.total = data.totals.find((t) => t.month === m)?.total ?? 0;
    return o;
  });
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <LineChart accessibilityLayer data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis width={44} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<RichTooltip config={config} fmt={(n) => String(n)} labelFmt={monthLabel} hideTotal />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k) => (
          <Line key={k} type="monotone" dataKey={k} stroke={`var(--color-${k})`} strokeWidth={2} dot={false} />
        ))}
        <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2.5} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
