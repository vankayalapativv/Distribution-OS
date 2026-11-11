"use client";

import { Input } from "@/components/ui/input";
import { rupeesExact } from "@/lib/format";
import { lineCategory, lineTotal, type ReturnLine } from "./sales-return-edit-logic";

/** The per-line return-quantity table (Item · Returnable · Rate · Return qty). */
export function SalesReturnLines({
  lines,
  qty,
  setQty,
}: {
  readonly lines: ReturnLine[];
  readonly qty: Record<string, string>;
  readonly setQty: (updater: (s: Record<string, string>) => Record<string, string>) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
        Nothing available to return on this invoice.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex-1">Item</span>
        <span className="w-16 shrink-0 text-right">Returnable</span>
        <span className="w-20 shrink-0 text-right">Rate</span>
        <span className="w-24 shrink-0 text-right">Return qty</span>
      </div>
      {lines.map((l) => {
        const lt = lineTotal(l, qty[l.orderItemId]);
        return (
          <div key={l.orderItemId} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{l.description}</p>
              <span className="mt-1 inline-flex rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {lineCategory(l)}
              </span>
            </div>
            <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{l.returnableUnits}</span>
            <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{rupeesExact(l.unitPrice)}</span>
            <div className="w-24 shrink-0">
              <Input
                type="number"
                min="0"
                max={l.returnableUnits}
                step="0.01"
                value={qty[l.orderItemId] ?? ""}
                onChange={(e) => setQty((s) => ({ ...s, [l.orderItemId]: e.target.value }))}
                placeholder="0"
                className="w-full text-right tabular-nums"
              />
              {lt > 0 ? (
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{rupeesExact(lt)}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
