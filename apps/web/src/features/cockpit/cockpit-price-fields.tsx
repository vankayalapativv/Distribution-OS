"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gstBreakdown } from "./cockpit-billing";

/** Model toggle (per-user / flat) + taxable BASE price input + live GST breakdown.
 *  The owner always enters the ex-GST base; storage/charges add 18% on top. */
export function CockpitPriceFields({
  model,
  amount,
  onModel,
  onAmount,
  disabled,
}: {
  model: "per_seat" | "flat";
  amount: string;
  onModel: (m: "per_seat" | "flat") => void;
  onAmount: (v: string) => void;
  disabled?: boolean;
}) {
  const b = gstBreakdown(Number(amount) || 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-md border border-border bg-secondary p-0.5 text-[12.5px]">
        {(["per_seat", "flat"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onModel(m)}
            className={`flex-1 rounded px-2 py-1 font-medium disabled:opacity-50 ${model === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "per_seat" ? "Per user" : "Flat"}
          </button>
        ))}
      </div>
      <Label className="text-[12px]">
        Base price, ex-GST (₹ {model === "per_seat" ? "/ user / month" : "/ month"})
      </Label>
      <Input
        className="font-mono"
        value={amount}
        onChange={(e) => onAmount(e.target.value)}
        inputMode="decimal"
        disabled={disabled}
      />
      <div className="rounded-md bg-secondary px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {b.base} <span className="text-foreground/40">+ 18% GST</span> {b.gst}{" "}
        <span className="text-foreground/40">=</span>{" "}
        <span className="font-semibold text-foreground">{b.total}</span>
        <span className="text-foreground/40"> {model === "per_seat" ? "/ user / month" : "/ month"}</span>
      </div>
    </div>
  );
}
