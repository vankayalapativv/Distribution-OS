"use client";

/** 6-month billed trend — an area chart of ₹ before GST over the months, and the
 *  collections trend (₹ collected per month). A single money series keeps each
 *  chart readable without a dual axis; litres stay in the table beneath. */
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { rupees } from "@/lib/format";
import { ChartEmpty, RichTooltip } from "./reports-chart-kit";
import type { CollectionTrendMonth, TrendMonth } from "./reports-types";

const config = { beforeGst: { label: "₹ before GST", color: "var(--chart-1)" } } satisfies ChartConfig;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09" → "Sep 26". */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? ym} ${y?.slice(2) ?? ""}`.trim();
}

export function TrendChart({ months }: { readonly months: TrendMonth[] }) {
  if (!months.some((m) => m.beforeGst > 0)) return <ChartEmpty />;
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <AreaChart accessibilityLayer data={months} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={monthLabel} />
        <YAxis tickFormatter={(v) => rupees(Number(v))} width={72} tickLine={false} axisLine={false} />
        <ChartTooltip content={<RichTooltip config={config} fmt={(n) => rupees(n)} labelFmt={monthLabel} />} />
        <Area
          type="monotone"
          dataKey="beforeGst"
          fill="var(--color-beforeGst)"
          fillOpacity={0.2}
          stroke="var(--color-beforeGst)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const collConfig = { total: { label: "Collected", color: "var(--chart-1)" } } satisfies ChartConfig;

/** 6-month collections trend — area of ₹ collected (verified+pending) per month. */
export function CollectionsTrendChart({ months }: { readonly months: CollectionTrendMonth[] }) {
  if (!months.some((m) => m.total > 0)) return <ChartEmpty />;
  return (
    <ChartContainer config={collConfig} className="aspect-auto h-[300px] w-full">
      <AreaChart accessibilityLayer data={months} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={monthLabel} />
        <YAxis tickFormatter={(v) => rupees(Number(v))} width={72} tickLine={false} axisLine={false} />
        <ChartTooltip content={<RichTooltip config={collConfig} fmt={(n) => rupees(n)} labelFmt={monthLabel} />} />
        <Area
          type="monotone"
          dataKey="total"
          fill="var(--color-total)"
          fillOpacity={0.2}
          stroke="var(--color-total)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
