"use client";

/** Shared chart primitives for the report drill-ins (shadcn Chart = Recharts).
 *  SimpleBarChart is a horizontal bar for single-series reports; the stacked
 *  (segment) and trend charts live in their own files. RichTooltip is the shared
 *  hover card: colour swatch + name + formatted value, plus share% + Total when
 *  the bar stacks more than one series. */
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

export interface BarDatum {
  label: string;
  value: number;
}

/** Distinct hues for categorical (multi-series) charts — the theme's --chart-N
 *  tokens are monochrome, which can't separate 7 segments. */
export const CATEGORICAL = [
  "hsl(221 83% 53%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(330 81% 60%)",
];

const truncate = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

export function ChartEmpty() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      No data to chart for this period.
    </div>
  );
}

interface TipItem {
  value?: number | string;
  dataKey?: string | number;
  name?: string | number;
  color?: string;
  payload?: { fill?: string };
}

/** Custom tooltip: one row per non-zero series (swatch · name · value [· share%]),
 *  with a Total footer when the bar stacks multiple series. */
export function RichTooltip({
  active,
  payload,
  label,
  config,
  fmt,
  withShare,
  labelFmt,
  hideTotal,
}: {
  readonly active?: boolean;
  readonly payload?: TipItem[];
  readonly label?: unknown;
  readonly config: ChartConfig;
  readonly fmt: (n: number) => string;
  readonly withShare?: boolean;
  readonly labelFmt?: (l: string) => string;
  readonly hideTotal?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.value != null && Number(p.value) !== 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, p) => sum + Number(p.value), 0);
  const multi = rows.length > 1 && !hideTotal;
  const header = labelFmt ? labelFmt(String(label)) : String(label);
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{header}</div>
      <div className="grid gap-1.5">
        {rows.map((p) => {
          const key = String(p.dataKey ?? p.name ?? "value");
          const name = (config[key]?.label as ReactNode) ?? key;
          const color = p.color ?? p.payload?.fill;
          const val = Number(p.value);
          const share = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="flex-1 text-muted-foreground">{name}</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{fmt(val)}</span>
              {withShare && multi ? (
                <span className="w-11 text-right font-mono tabular-nums text-muted-foreground">{share}%</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {multi ? (
        <div className="flex items-center gap-2 border-t border-border/50 pt-1 font-medium text-foreground">
          <span className="size-2.5 shrink-0" />
          <span className="flex-1">Total</span>
          <span className="font-mono tabular-nums">{fmt(total)}</span>
          {withShare ? <span className="w-11" /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal bar: one bar per row (callers pre-sort). Zero-value rows are dropped. */
export function SimpleBarChart({
  data,
  seriesLabel,
  fmt,
  color = "var(--chart-1)",
}: {
  readonly data: BarDatum[];
  readonly seriesLabel: string;
  readonly fmt: (n: number) => string;
  readonly color?: string;
}) {
  const rows = data.filter((d) => d.value > 0);
  if (rows.length === 0) return <ChartEmpty />;
  const config = { value: { label: seriesLabel, color } } satisfies ChartConfig;
  const height = Math.max(200, rows.length * 34 + 48);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tickLine={false}
          axisLine={false}
          tickFormatter={truncate}
        />
        <ChartTooltip content={<RichTooltip config={config} fmt={fmt} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
