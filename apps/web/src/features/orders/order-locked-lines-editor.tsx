"use client";

import { Input } from "@/components/ui/input";
import type { LockedLine } from "./order-draft-types";

/** Quantity-only editor for already-invoiced (partial-delivery) lines: the product,
 *  pack and customer can't change, and the quantity can't drop below what's billed. */
export function OrderLockedLinesEditor({
  lockedLines,
  onSetQty,
}: {
  readonly lockedLines: LockedLine[];
  readonly onSetQty: (orderItemId: string, quantityUnits: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Already invoiced — quantity only
      </p>
      <p className="text-[11px] leading-snug text-amber-700">
        These lines are billed on an invoice. You can raise or lower the total quantity (never below
        what&apos;s already billed); the product, pack and the customer can&apos;t change, and these
        lines can&apos;t be removed. Add any new lines below.
      </p>
      {lockedLines.map((l) => (
        <div key={l.orderItemId} className="flex items-center gap-3">
          <span className="flex-1 truncate text-sm text-foreground">{l.label}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">{l.invoicedUnits} billed</span>
          <Input
            type="number"
            min={l.invoicedUnits}
            step={1}
            value={l.quantityUnits}
            onChange={(e) => onSetQty(l.orderItemId, e.target.value)}
            className="h-9 w-24"
          />
        </div>
      ))}
    </div>
  );
}
