"use client";

import { barColor } from "./target-bar-colors";

/** One actual-vs-target completion bar (oil litres). */
export function Bar({
  label,
  actual,
  target,
  format,
}: Readonly<{
  label: string;
  actual: number;
  target: number | null;
  format: (v: number) => string;
}>) {
  const pct = target && target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-foreground">
          {format(actual)}
          {target && target > 0 ? <span className="text-muted-foreground"> / {format(target)}</span> : null}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        {pct === null ? (
          <div className="h-full w-full bg-muted" title="No target set" />
        ) : (
          <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        )}
      </div>
    </div>
  );
}
