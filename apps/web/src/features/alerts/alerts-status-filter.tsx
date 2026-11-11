"use client";

import type { AlertStatusFilter } from "./use-alerts";

const OPTIONS: AlertStatusFilter[] = ["open", "all", "closed"];

/** Open / All / Closed pill toggle for the alerts list. */
export function AlertsStatusFilter({
  value, onChange,
}: {
  readonly value: AlertStatusFilter;
  readonly onChange: (value: AlertStatusFilter) => void;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
            value === s
              ? "bg-primary text-primary-foreground"
              : "bg-white text-muted-foreground ring-1 ring-border hover:bg-accent"
          }`}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
  );
}
