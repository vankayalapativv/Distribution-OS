"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { formatMonthYear } from "@/components/form/month-year-field";
import { type ActionConfig } from "@/lib/api-client";
import { fetchAvailableLots, packLabel, type Lot, type Sku, type StockUnit } from "./stock-api";

/** A transfer line is one (SKU, source batch) pair — split a SKU across batches
 *  by adding it again. Keyed by the source lot id. */
export interface TransferLine {
  productId: string; productName: string; packSizeLitres: number; brand: string | null; unit: StockUnit;
  fromBatchId: string; qty: string;
  destRack: string; destShelf: string; destBin: string;
}
export const skuKey = (p: { productId: string; packSizeLitres: number }) => `${p.productId}|${p.packSizeLitres}`;
export const lineOk = (l: TransferLine) => l.qty.trim() !== "" && Number.isFinite(Number(l.qty)) && Number(l.qty) > 0;

/** Lot-aware line state for Transfer: picking a SKU fetches its on-hand lots at
 *  the source godown and adds a line on the soonest-expiry (FEFO) lot not yet used. */
export function useTransferLines(actionConfig: ActionConfig, fromId: string) {
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [lotsBySku, setLotsBySku] = useState<Record<string, Lot[]>>({});

  const reset = () => { setLines([]); setLotsBySku({}); };
  const lotsFor = (l: { productId: string; packSizeLitres: number }) => lotsBySku[skuKey(l)] ?? [];
  const selectedLot = (l: TransferLine) => lotsFor(l).find((x) => x.id === l.fromBatchId);

  const add = async (sku: Sku) => {
    const key = skuKey(sku);
    let lots = lotsBySku[key];
    if (!lots) {
      lots = await fetchAvailableLots(actionConfig, { locationId: fromId, productId: sku.productId, packSizeLitres: sku.packSizeLitres });
      setLotsBySku((m) => ({ ...m, [key]: lots! }));
    }
    const used = new Set(lines.filter((l) => skuKey(l) === key).map((l) => l.fromBatchId));
    const next = lots.find((lot) => !used.has(lot.id));
    if (!next) return; // no stock here, or every batch already on a line
    setLines((ls) => [...ls, {
      productId: sku.productId, productName: sku.productName, packSizeLitres: sku.packSizeLitres, brand: sku.brand, unit: sku.unit,
      fromBatchId: next.id, qty: "", destRack: next.rackNo ?? "", destShelf: next.shelfNo ?? "", destBin: next.binNo ?? "",
    }]);
  };

  const set = (i: number, patch: Partial<TransferLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  return { lines, add, set, remove, reset, lotsFor, selectedLot };
}

export function TransferGrid({ L }: Readonly<{ L: ReturnType<typeof useTransferLines> }>) {
  if (L.lines.length === 0) return <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Pick the source godown, then search a product to move.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="w-[220px] px-3 py-2.5 text-left font-semibold">Product</th>
          <th className="px-2 py-2.5 text-left font-semibold">Batch (FEFO)</th>
          <th className="px-2 py-2.5 text-center font-semibold">Qty to move</th>
          <th className="px-2 py-2.5 text-center font-semibold">Destination rack / shelf / bin</th>
          <th className="w-9" />
        </tr></thead>
        <tbody>
          {L.lines.map((l, i) => {
            const lots = L.lotsFor(l);
            const sel = L.selectedLot(l);
            const usedByOthers = new Set(L.lines.filter((x, j) => j !== i && skuKey(x) === skuKey(l)).map((x) => x.fromBatchId));
            const options = lots.filter((lot) => lot.id === l.fromBatchId || !usedByOthers.has(lot.id));
            const avail = sel?.qtyUnits ?? 0;
            const qn = Number(l.qty);
            const short = l.qty.trim() !== "" && Number.isFinite(qn) && qn > avail;
            return (
              <tr key={l.fromBatchId} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="max-w-[200px] break-words font-medium text-foreground">{l.productName}</div>
                  <div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}{l.brand ? ` · ${l.brand}` : ""}</div>
                </td>
                <td className="px-2 py-2">
                  <SearchSelect
                    items={options} valueKey={l.fromBatchId} getKey={(x) => x.id}
                    getLabel={(x) => `${x.batchNumber ?? "—"} · ${x.expiryDate ? formatMonthYear(x.expiryDate) : "no exp"} · ${x.rate != null ? `@${x.rate.toLocaleString("en-IN")}` : "unpriced"} · ${x.qtyUnits} left`}
                    onSelect={(id) => { const lot = lots.find((x) => x.id === id); L.set(i, { fromBatchId: id, destRack: lot?.rackNo ?? "", destShelf: lot?.shelfNo ?? "", destBin: lot?.binNo ?? "" }); }}
                    placeholder="Pick a batch" searchPlaceholder="Search batch…" emptyText="No batches" contentClassName="w-[340px] p-0" triggerClassName="w-60"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="mx-auto w-24">
                    <Input inputMode="decimal" value={l.qty} placeholder="0" onChange={(e) => L.set(i, { qty: e.target.value })} className={`h-8 text-right font-mono ${short ? "border-destructive focus-visible:ring-destructive/30" : ""}`} />
                    <div className={`mt-0.5 text-right text-[10px] ${short ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{avail} left</div>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-center gap-1">
                    <Input value={l.destRack} placeholder="Rack" onChange={(e) => L.set(i, { destRack: e.target.value })} className="h-8 w-16 text-center" />
                    <Input value={l.destShelf} placeholder="Shelf" onChange={(e) => L.set(i, { destShelf: e.target.value })} className="h-8 w-16 text-center" />
                    <Input value={l.destBin} placeholder="Bin" onChange={(e) => L.set(i, { destBin: e.target.value })} className="h-8 w-16 text-center" />
                  </div>
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
