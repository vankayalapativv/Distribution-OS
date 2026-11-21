"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { litres } from "@/lib/format";
import type { LockedLine } from "./order-draft-types";

/** "Brand · Segment · N L" sub-line, mirroring the order's own line details. */
export function LineMeta({ line }: { readonly line: LockedLine }) {
  const parts = [
    line.brand,
    line.segment,
    line.packSizeLitres ? `${litres(line.packSizeLitres)} L` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="block truncate text-[11px] text-muted-foreground">{parts.join(" · ")}</span>;
}

/** One editable un-invoiced remainder. Holds its own string state so the field can
 *  be emptied while typing (the row never unmounts — eligibility is fixed on the
 *  parent's immutable orderedUnits), and reports the new TOTAL (billed + remainder)
 *  up to the draft. */
export function RemainderRow({
  line,
  onSetQty,
}: {
  readonly line: LockedLine;
  readonly onSetQty: (orderItemId: string, quantityUnits: string) => void;
}) {
  const committed = line.invoicedUnits;
  const [value, setValue] = useState(String(Math.max(0, Number(line.quantityUnits) - committed)));

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{line.label}</span>
        <LineMeta line={line} />
      </span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{committed} billed</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          setValue(raw); // keep the field as typed — including empty — so backspace works
          const remainder = Math.max(0, Math.floor(Number(raw) || 0));
          onSetQty(line.orderItemId, String(committed + remainder));
        }}
        className="h-9 w-24"
      />
    </div>
  );
}
