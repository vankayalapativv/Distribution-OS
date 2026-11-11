"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { litres } from "@/lib/format";
import type { LockedLine } from "./order-draft-types";

/** "Brand · Segment · N L" sub-line, mirroring the order's own line details. */
function LineMeta({ line }: { readonly line: LockedLine }) {
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
function RemainderRow({
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

/**
 * Editor for already-invoiced (partial-delivery) lines. Each line is shown in two
 * parts: the FULFILLED portion (delivered or billed) is read-only — those goods
 * are committed and can't be changed or removed; the un-invoiced REMAINDER, if any,
 * is a prefilled quantity-only field (product/pack fixed — set it to 0 to drop the
 * remainder). New products are added through the grid below.
 */
export function OrderLockedLinesEditor({
  lockedLines,
  onSetQty,
}: {
  readonly lockedLines: LockedLine[];
  readonly onSetQty: (orderItemId: string, quantityUnits: string) => void;
}) {
  // Eligibility is decided on the ORIGINAL ordered quantity, never the live edited
  // value — so clearing a remainder field to 0 can't filter its row out mid-edit.
  const remainders = lockedLines.filter((l) => l.orderedUnits > l.invoicedUnits);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Already fulfilled — locked
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          These quantities are already invoiced or delivered and can&apos;t be changed or removed.
        </p>
        {lockedLines.map((l) => (
          <div key={l.orderItemId} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-muted-foreground">{l.label}</span>
              <LineMeta line={l} />
            </span>
            <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
              {l.deliveredUnits > 0 ? `${l.deliveredUnits} delivered` : `${l.invoicedUnits} billed`}
            </span>
          </div>
        ))}
      </div>

      {remainders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Remaining to invoice — quantity only
          </p>
          <p className="text-[11px] leading-snug text-amber-700">
            The un-invoiced balance of these lines. The product and pack are fixed — adjust the
            quantity, or set it to 0 to drop the remainder. Add any new products below.
          </p>
          {remainders.map((l) => (
            <RemainderRow key={l.orderItemId} line={l} onSetQty={onSetQty} />
          ))}
        </div>
      )}
    </div>
  );
}
