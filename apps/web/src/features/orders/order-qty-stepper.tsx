"use client";

import { Input } from "@/components/ui/input";

interface OrderQtyStepperProps {
  value: number;
  /** Disable the whole control (e.g. no part selected yet). */
  disabled?: boolean;
  /** Paint the field red when the typed quantity is invalid. */
  invalid?: boolean;
  onStep: (direction: 1 | -1) => void;
  onSet: (value: number) => void;
}

/**
 * The −/+ quantity control for line rows: two step
 * buttons around a right-aligned numeric input. `value || ""` keeps a bare 0 from
 * showing so the field reads empty until the user types.
 */
export function OrderQtyStepper({ value, disabled, invalid, onStep, onSet }: Readonly<OrderQtyStepperProps>) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-base font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-40";
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={disabled}
        className={btn}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <Input
        type="number"
        min={0}
        className={`h-8 w-[72px] bg-background text-right text-sm ${invalid ? "border-destructive text-destructive" : ""}`}
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onSet(Number(e.target.value))}
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={disabled}
        className={btn}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
