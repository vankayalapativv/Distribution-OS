"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { MonthYearField, formatMonthYear } from "@/components/form/month-year-field";
import { type ActionConfig } from "@/lib/api-client";
import { fetchAvailableLots, packLabel, type Lot, type Sku, type StockUnit } from "./stock-api";
import { skuKey } from "./stock-transfer-grid";

/** An adjustment line: a signed delta. Negative reduces a picked lot; positive is
 *  a corrective receipt that requires a batch + expiry. */
export interface AdjustLine {
  id: string; productId: string; productName: string; packSizeLitres: number; brand: string | null; unit: StockUnit;
  delta: string; batchId: string;
  batchNumber: string; expiry: string; rack: string; shelf: string; bin: string;
}
export const adjSign = (l: AdjustLine) => { const n = Number(l.delta); return l.delta.trim() === "" || !Number.isFinite(n) ? 0 : Math.sign(n); };
export const adjLineOk = (l: AdjustLine, remaining: number) => {
  const s = adjSign(l);
  if (s === 0) return false;
  if (s < 0) return Boolean(l.batchId) && Math.abs(Number(l.delta)) <= remaining;
  return l.batchNumber.trim() !== "" && l.expiry.trim() !== "";
};

export function useAdjustLines(actionConfig: ActionConfig, locationId: string) {
  const [lines, setLines] = useState<AdjustLine[]>([]);
  const [lotsBySku, setLotsBySku] = useState<Record<string, Lot[]>>({});
  const reset = () => { setLines([]); setLotsBySku({}); };
  const lotsFor = (l: { productId: string; packSizeLitres: number }) => lotsBySku[skuKey(l)] ?? [];
  const selectedLot = (l: AdjustLine) => lotsFor(l).find((x) => x.id === l.batchId);

  const add = async (sku: Sku) => {
    const key = skuKey(sku);
    if (!lotsBySku[key]) {
      const lots = await fetchAvailableLots(actionConfig, { locationId, productId: sku.productId, packSizeLitres: sku.packSizeLitres });
      setLotsBySku((m) => ({ ...m, [key]: lots }));
    }
    setLines((ls) => [...ls, {
      id: crypto.randomUUID(), productId: sku.productId, productName: sku.productName, packSizeLitres: sku.packSizeLitres, brand: sku.brand, unit: sku.unit,
      delta: "", batchId: "", batchNumber: "", expiry: "", rack: "", shelf: "", bin: "",
    }]);
  };
  const set = (i: number, patch: Partial<AdjustLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  return { lines, add, set, remove, reset, lotsFor, selectedLot };
}

function NegativeCell({ l, i, L }: Readonly<{ l: AdjustLine; i: number; L: ReturnType<typeof useAdjustLines> }>) {
  const lots = L.lotsFor(l);
  const avail = L.selectedLot(l)?.qtyUnits ?? 0;
  const short = Math.abs(Number(l.delta)) > avail;
  return (
    <div className="flex items-center gap-2">
      <SearchSelect
        items={lots} valueKey={l.batchId} getKey={(x) => x.id}
        getLabel={(x) => `${x.batchNumber ?? "—"} · ${x.expiryDate ? formatMonthYear(x.expiryDate) : "no exp"} · ${x.rate != null ? `@${x.rate.toLocaleString("en-IN")}` : "unpriced"} · ${x.qtyUnits} left`}
        onSelect={(id) => L.set(i, { batchId: id })}
        placeholder={lots.length === 0 ? "No stock here" : "Pick the batch to reduce"} searchPlaceholder="Search batch…" emptyText="No batches" contentClassName="w-[340px] p-0" triggerClassName="w-64"
      />
      {l.batchId && <span className={`shrink-0 text-[11px] ${short ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{avail} left</span>}
    </div>
  );
}

function PositiveCell({ l, i, L }: Readonly<{ l: AdjustLine; i: number; L: ReturnType<typeof useAdjustLines> }>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input value={l.batchNumber} placeholder="Batch no*" onChange={(e) => L.set(i, { batchNumber: e.target.value })} className="h-8 w-28" />
      <div className="w-28"><MonthYearField value={l.expiry} onChange={(v) => L.set(i, { expiry: v })} placeholder="Expiry*" className="px-2" /></div>
      <Input value={l.rack} placeholder="Rack" onChange={(e) => L.set(i, { rack: e.target.value })} className="h-8 w-14 text-center" />
      <Input value={l.shelf} placeholder="Shelf" onChange={(e) => L.set(i, { shelf: e.target.value })} className="h-8 w-14 text-center" />
      <Input value={l.bin} placeholder="Bin" onChange={(e) => L.set(i, { bin: e.target.value })} className="h-8 w-14 text-center" />
    </div>
  );
}

export function AdjustGrid({ L }: Readonly<{ L: ReturnType<typeof useAdjustLines> }>) {
  if (L.lines.length === 0) return <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Pick the godown, then search a product to adjust.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="w-[200px] px-3 py-2.5 text-left font-semibold">Product</th>
          <th className="px-2 py-2.5 text-center font-semibold">Change (+/−)</th>
          <th className="px-2 py-2.5 text-left font-semibold">Reduce a batch (−) · or new batch + expiry (+)</th>
          <th className="w-9" />
        </tr></thead>
        <tbody>
          {L.lines.map((l, i) => {
            const s = adjSign(l);
            let qtyTone = "";
            if (s < 0) qtyTone = "text-destructive";
            else if (s > 0) qtyTone = "text-green-700";
            let changeCell: ReactNode;
            if (s < 0) changeCell = <NegativeCell l={l} i={i} L={L} />;
            else if (s > 0) changeCell = <PositiveCell l={l} i={i} L={L} />;
            else changeCell = <span className="text-[11px] text-muted-foreground">Enter a change: − reduces a batch, + adds a new one.</span>;
            return (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="max-w-[180px] break-words font-medium text-foreground">{l.productName}</div>
                  <div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}{l.brand ? ` · ${l.brand}` : ""}</div>
                </td>
                <td className="px-2 py-2">
                  <div className="mx-auto w-24">
                    <Input inputMode="numeric" value={l.delta} placeholder="e.g. -6" onChange={(e) => L.set(i, { delta: e.target.value })} className={`h-8 text-right font-mono ${qtyTone}`} />
                  </div>
                </td>
                <td className="px-2 py-2">
                  {changeCell}
                </td>
                <td className="px-1 py-2 text-center"><button type="button" onClick={() => L.remove(i)} aria-label="Remove row" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
