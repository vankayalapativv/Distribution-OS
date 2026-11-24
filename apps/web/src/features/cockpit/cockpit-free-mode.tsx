"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FreeMode } from "./cockpit-billing";

const MODES: Array<{ key: FreeMode; label: string; hint: string }> = [
  { key: "immediate", label: "Bill immediately", hint: "Charge from this month" },
  { key: "this_month", label: "Rest of this month", hint: "Free until month-end, then bill" },
  { key: "n_months", label: "Free for N months", hint: "Free for a fixed number of months" },
  { key: "forever", label: "Free until I turn it on", hint: "Open-ended free (no billing yet)" },
];

/** Free-period selector: four modes + a months input for the fixed-N mode. */
export function CockpitFreeMode({
  mode,
  months,
  onMode,
  onMonths,
  disabled,
}: {
  mode: FreeMode;
  months: string;
  onMode: (m: FreeMode) => void;
  onMonths: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[12px]">Free period</Label>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            disabled={disabled}
            onClick={() => onMode(m.key)}
            className={`rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors disabled:opacity-50 ${
              mode === m.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent"
            }`}
          >
            <div className="font-semibold">{m.label}</div>
            <div className="text-[10.5px] leading-tight text-muted-foreground">{m.hint}</div>
          </button>
        ))}
      </div>
      {mode === "n_months" ? (
        <div className="flex items-center gap-2">
          <Input
            className="w-20 font-mono"
            value={months}
            onChange={(e) => onMonths(e.target.value)}
            inputMode="numeric"
            disabled={disabled}
            aria-label="Free months"
          />
          <span className="text-[12px] text-muted-foreground">month(s) free from this month</span>
        </div>
      ) : null}
    </div>
  );
}
