"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductPack } from "./products-api";

/** Per-pack editor: add the litre sizes a product comes in. Pricing (MRP/MOP/DLP)
 *  is no longer catalogue data — it's entered per scenario in the Margin simulator. */
export function PackRows({
  packs,
  onChange,
}: {
  readonly packs: ProductPack[];
  readonly onChange: (packs: ProductPack[]) => void;
}) {
  const [sizeInput, setSizeInput] = useState("");
  const addSize = () => {
    const n = Number(sizeInput);
    if (n > 0 && !packs.some((p) => p.packSize === n)) {
      onChange([...packs, { packSize: n }].sort((a, b) => a.packSize - b.packSize));
    }
    setSizeInput("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Pack Sizes <span className="text-destructive">*</span> (litres)</Label>
      <div className="flex gap-2">
        <Input
          type="number" step="any" min="0" inputMode="decimal" value={sizeInput}
          onChange={(e) => setSizeInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }}
          placeholder="Add a pack in litres, e.g. 0.5 or 0.037"
        />
        <Button type="button" variant="outline" onClick={addSize}>Add</Button>
      </div>
      {packs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {packs.map((p) => (
            <span key={p.packSize} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-sm">
              <span className="font-medium">{p.packSize} L</span>
              <button
                type="button" aria-label="Remove pack"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(packs.filter((x) => x.packSize !== p.packSize))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
