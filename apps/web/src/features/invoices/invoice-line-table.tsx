"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { litres } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sku } from "@/features/stock/stock-api";
import { lineTax, round2, type InvoiceFormLine } from "./invoice-generate-api";

const num = (v: string) => Number(v) || 0;
const inr = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

interface Pack { packSizeLitres: number; hsnCode: string | null }
interface Prod { productId: string; productName: string }

/** One cascading dropdown cell. Disabled renders a muted placeholder (the step
 *  before it isn't chosen yet). */
function CellSelect<T>({ items, value, getKey, getLabel, onSelect, placeholder, disabled }: Readonly<{
  items: T[]; value: string; getKey: (t: T) => string; getLabel: (t: T) => string;
  onSelect: (v: string) => void; placeholder: string; disabled?: boolean;
}>) {
  if (disabled) {
    return <div className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/30 px-2.5 text-[13px] text-muted-foreground/50">—</div>;
  }
  return (
    <SearchSelect items={items} valueKey={value} getKey={getKey} getLabel={getLabel} onSelect={onSelect}
      placeholder={placeholder} searchPlaceholder="Search…" emptyText="None" contentClassName="w-[240px] p-0" />
  );
}

/** Full-width invoice line table. "Add item" drops an empty row; the pickers
 *  cascade Brand → Segment → SKU → Pack, then qty / MRP (= rate) / discount. */
export function InvoiceLineTable({
  lines, skus, supply, stockMap, balancesReady, onAdd, onChange, onRemove,
}: Readonly<{
  lines: InvoiceFormLine[];
  skus: Sku[];
  supply: "intra" | "inter";
  stockMap: Map<string, number>;
  balancesReady: boolean;
  onAdd: () => void;
  onChange: (i: number, patch: Partial<InvoiceFormLine>) => void;
  onRemove: (i: number) => void;
}>) {
  const brands = uniq(skus.map((s) => s.brand).filter((b): b is string => !!b)).sort((a, b) => a.localeCompare(b));
  const segmentsFor = (brand: string | null) =>
    uniq(skus.filter((s) => s.brand === brand).map((s) => s.segment).filter((x): x is string => !!x)).sort((a, b) => a.localeCompare(b));
  const productsFor = (brand: string | null, segment: string | null): Prod[] => {
    const m = new Map<string, string>();
    for (const s of skus) if (s.brand === brand && s.segment === segment && !m.has(s.productId)) m.set(s.productId, s.productName);
    return [...m].map(([productId, productName]) => ({ productId, productName })).sort((a, b) => a.productName.localeCompare(b.productName));
  };
  const packsFor = (productId: string): Pack[] => {
    const m = new Map<number, string | null>();
    for (const s of skus) if (s.productId === productId && !m.has(s.packSizeLitres)) m.set(s.packSizeLitres, s.hsnCode);
    return [...m].map(([packSizeLitres, hsnCode]) => ({ packSizeLitres, hsnCode })).sort((a, b) => a.packSizeLitres - b.packSizeLitres);
  };

  let taxable = 0;
  for (const l of lines) if (num(l.qty) > 0 && num(l.rate) > 0) taxable += lineTax(num(l.qty), num(l.rate), supply, num(l.discountPct)).taxable;
  taxable = round2(taxable);

  // Shared cell padding so the header label's right edge lines up with the
  // right-aligned input below it (same px on <th> and <td>).
  const th = "px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  const cell = "px-2.5 py-3";
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">Line items <span className="font-normal text-muted-foreground">· {lines.length}</span></div>
        <Button onClick={onAdd}><Plus className="size-4" />Add item</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed text-sm">
          {/* Even, full-width column spread — percentages sum to 100% + the delete col.
              Amount is wide enough to hold a lakh-scale ₹ value on one line, so it
              never overflows into the delete button. */}
          <colgroup>
            <col className="w-[13%]" /><col className="w-[11%]" /><col className="w-[21%]" /><col className="w-[10%]" />
            <col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[8%]" /><col className="w-[14%]" /><col className="w-10" />
          </colgroup>
          <thead><tr className="border-b border-border bg-muted/40">
            <th className={th}>Brand</th><th className={th}>Segment</th><th className={th}>SKU</th><th className={th}>Pack (L)</th>
            <th className={cn(th, "text-right")}>Qty</th><th className={cn(th, "text-right")}>MRP ₹</th>
            <th className={cn(th, "text-right")}>Disc %</th><th className={cn(th, "text-right")}>Amount ₹</th><th className="w-10" />
          </tr></thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">No lines yet — click <b className="text-foreground">Add item</b> to start.</td></tr>
            ) : lines.map((l, i) => {
              const stock = l.productId && l.packSizeLitres > 0 && balancesReady ? (stockMap.get(`${l.productId}|${l.packSizeLitres}`) ?? 0) : undefined;
              const short = stock !== undefined && num(l.qty) > stock;
              const priced = num(l.qty) > 0 && num(l.rate) > 0;
              return (
                <tr key={l.uid} className="border-b border-border/60 align-top last:border-0">
                  <td className={cell}>
                    <CellSelect items={brands} value={l.brand ?? ""} getKey={(b) => b} getLabel={(b) => b} placeholder="Brand"
                      onSelect={(v) => onChange(i, { brand: v || null, segment: null, productId: "", productName: "", packSizeLitres: 0, hsnCode: null })} />
                  </td>
                  <td className={cell}>
                    <CellSelect items={segmentsFor(l.brand)} value={l.segment ?? ""} getKey={(s) => s} getLabel={(s) => s} placeholder="Segment" disabled={!l.brand}
                      onSelect={(v) => onChange(i, { segment: v || null, productId: "", productName: "", packSizeLitres: 0, hsnCode: null })} />
                  </td>
                  <td className={cell}>
                    <CellSelect items={productsFor(l.brand, l.segment)} value={l.productId} getKey={(p) => p.productId} getLabel={(p) => p.productName} placeholder="Select SKU" disabled={!l.segment}
                      onSelect={(v) => { const p = productsFor(l.brand, l.segment).find((x) => x.productId === v); onChange(i, { productId: v, productName: p?.productName ?? "", packSizeLitres: 0, hsnCode: null }); }} />
                  </td>
                  <td className={cell}>
                    <CellSelect items={packsFor(l.productId)} value={l.packSizeLitres ? String(l.packSizeLitres) : ""} getKey={(p) => String(p.packSizeLitres)} getLabel={(p) => `${litres(p.packSizeLitres)} L`} placeholder="Pack" disabled={!l.productId}
                      onSelect={(v) => { const p = packsFor(l.productId).find((x) => String(x.packSizeLitres) === v); onChange(i, { packSizeLitres: Number(v), hsnCode: p?.hsnCode ?? null }); }} />
                  </td>
                  <td className={cell}>
                    <Input inputMode="decimal" value={l.qty} onChange={(e) => onChange(i, { qty: e.target.value })} className={cn("h-9 w-full text-right font-mono", short && "border-destructive")} />
                    {stock !== undefined && (
                      <div className="mt-1 text-right text-[10px]">{short ? <span className="font-medium text-destructive">only {stock}</span> : <span className="text-muted-foreground">{stock} on hand</span>}</div>
                    )}
                  </td>
                  <td className={cell}><Input inputMode="decimal" value={l.mrp} onChange={(e) => onChange(i, { mrp: e.target.value, rate: e.target.value })} placeholder="0.00" className="h-9 w-full text-right font-mono" /></td>
                  <td className={cell}><Input inputMode="decimal" value={l.discountPct} onChange={(e) => onChange(i, { discountPct: e.target.value })} className="h-9 w-full text-right font-mono" /></td>
                  <td className={cn(cell, "whitespace-nowrap text-right font-mono font-semibold text-foreground")}>{priced ? inr(lineTax(num(l.qty), num(l.rate), supply, num(l.discountPct)).taxable) : "—"}</td>
                  <td className={cn(cell, "text-center")}><button type="button" onClick={() => onRemove(i)} aria-label="Remove line" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot><tr className="border-t border-border"><td colSpan={7} className="px-2.5 py-3 text-right text-xs font-medium text-muted-foreground">Taxable value</td><td className="whitespace-nowrap px-2.5 py-3 text-right font-mono font-bold text-foreground">{inr(taxable)}</td><td /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
