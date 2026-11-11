"use client";

import { cn } from "@/lib/utils";
import { STAGE_TINTS, type StageDef } from "./order-fulfillment-summary-groups";

/** One clickable stage tile — toggles the table's fulfillment filter (click the
 *  active tile again to clear). */
export function FulfillmentTile({
  stage,
  value,
  active,
  onSelect,
}: {
  readonly stage: StageDef;
  readonly value: number;
  readonly active: string;
  readonly onSelect: (value: string) => void;
}) {
  const t = STAGE_TINTS[stage.token];
  const isActive = active === stage.token;
  return (
    <button
      type="button"
      onClick={() => onSelect(isActive ? "" : stage.token)}
      aria-pressed={isActive}
      className={cn(
        "flex min-w-[78px] cursor-pointer flex-col items-start rounded-lg border border-l-[3px] px-3 py-2 text-left shadow-sm transition-shadow hover:shadow",
        t.card,
        isActive && "ring-2 ring-primary/40",
      )}
    >
      <span className={cn("text-[11px] font-medium", t.label)}>{stage.label}</span>
      <span className={cn("mt-0.5 font-bold tabular-nums", stage.emphasized ? "text-2xl" : "text-lg", t.value)}>
        {value}
      </span>
    </button>
  );
}
