"use client";

/**
 * Shared stock-entry kit — line state, the godown/date fields, and the grid
 * primitives used by the stock-entry page panels (stock-entry-panels.tsx).
 * The old modal dialogs were replaced by the full-page /stock/entry flow.
 */
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { DateField } from "@/components/form/date-field";
import { MonthYearField } from "@/components/form/month-year-field";
import { type ActionConfig } from "@/lib/api-client";
import { fetchOnHand, packLabel, type Sku, type StockLocation, type StockUnit } from "./stock-api";

export interface Line {
  productId: string; productName: string; packSizeLitres: number; brand: string | null; unit: StockUnit; a: string; b: string;
  // Optional stock-in details (GRN + opening).
  batch?: string; expiry?: string; rack?: string; shelf?: string; bin?: string;
}
export const keyOf = (l: { productId: string; packSizeLitres: number }) => `${l.productId}|${l.packSizeLitres}`;

export function DateCell({ value, onChange, label = "Date", required }: Readonly<{ value: string; onChange: (v: string) => void; label?: string; required?: boolean }>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive">*</span>}</Label>
      <DateField value={value} onChange={onChange} />
    </div>
  );
}

export function useLines() {
  const [lines, setLines] = useState<Line[]>([]);
  const add = (s: Sku) =>
    setLines((ls) => [...ls, { productId: s.productId, productName: s.productName, packSizeLitres: s.packSizeLitres, brand: s.brand, unit: s.unit, a: "", b: "" }]);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  return { lines, add, set, remove, setLines, keys: new Set(lines.map(keyOf)) };
}

export function LocationSelect({ locations, value, onChange, label = "Godown", required }: Readonly<{ locations: StockLocation[]; value: string; onChange: (v: string) => void; label?: string; required?: boolean }>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive">*</span>}</Label>
      <SearchSelect
        items={locations}
        valueKey={value}
        getKey={(l) => l.id}
        getLabel={(l) => l.name}
        onSelect={onChange}
        placeholder="Select a godown"
        searchPlaceholder="Search godown…"
        emptyText="No godowns found"
        contentClassName="w-[280px] p-0"
      />
    </div>
  );
}

export function qtyInput(value: string, onChange: (v: string) => void, placeholder = "0", invalid = false) {
  return (
    <Input
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-24 text-right font-mono ${invalid ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
    />
  );
}

/** On-hand units per SKU at `locationId` for the picked lines — the out-of-stock
 *  hard block. Refetches only when the godown or the SET of SKUs changes. */
export function useOnHand(actionConfig: ActionConfig, locationId: string, lines: Line[]): Map<string, number> {
  const skuKey = lines.map(keyOf).sort((a, b) => a.localeCompare(b)).join(",");
  const q = useQuery({
    queryKey: ["stock-onhand", locationId, skuKey],
    queryFn: () => fetchOnHand(actionConfig, locationId, lines.map((l) => ({ productId: l.productId, packSizeLitres: l.packSizeLitres }))),
    enabled: Boolean(locationId) && lines.length > 0,
  });
  return q.data ?? new Map<string, number>();
}

/** The qty cell for a stock-OUT line: qty input (red when short) + an on-hand
 *  hint. `short` is already computed by the caller (negative-only for adjust). */
export function outQtyCell(value: string, onChange: (v: string) => void, available: number, short: boolean, placeholder = "0") {
  return (
    <div className="flex flex-col items-end gap-0.5">
      {qtyInput(value, onChange, placeholder, short)}
      <span className="text-[10px]">
        {short ? <span className="font-medium text-destructive">only {available} on hand</span> : <span className="text-muted-foreground">{available} on hand</span>}
      </span>
    </div>
  );
}

export const num = Number;
export const valid = (v: string) => v.trim() !== "" && Number.isFinite(num(v));

/** A borderless spreadsheet cell — transparent until hover/focus. `invalid`
 *  draws a red border to flag a required-but-missing value (e.g. a mandatory rate). */
export function gridCell(
  value: string, onChange: (v: string) => void,
  opts?: Readonly<{ placeholder?: string; mono?: boolean; w?: string; decimal?: boolean; invalid?: boolean }>,
) {
  const { placeholder = "", mono, w = "w-16", decimal, invalid } = opts ?? {};
  return (
    <div className="flex justify-center">
      <Input
        {...(decimal ? { inputMode: "decimal" as const } : {})}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 ${w} rounded-md px-2 text-center placeholder:text-muted-foreground/60 ${mono ? "font-mono" : ""} ${invalid ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
      />
    </div>
  );
}

/** A line needs a rate (mandatory on stock-in + opening): true when a positive
 *  qty is entered but the rate is blank or not a number > 0. */
export const rateMissing = (l: Line) => valid(l.a) && num(l.a) > 0 && !(valid(l.b) && num(l.b) > 0);

/** GRN line entry as a spreadsheet grid — one row per product, every optional
 *  detail (batch/expiry/rack/shelf/bin) inline + a computed amount. */
export function GrnGrid({ lines, set, remove }: Readonly<{
  lines: Line[]; set: (i: number, patch: Partial<Line>) => void; remove: (i: number) => void;
}>) {
  if (lines.length === 0) return <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Search a product above to add rows.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[780px] text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="w-[200px] px-3 py-2.5 text-left font-semibold">Product</th>
          <th className="px-2 py-2.5 text-center font-semibold">Qty</th>
          <th className="px-2 py-2.5 text-center font-semibold">Rate<span className="text-destructive">*</span></th>
          <th className="px-2 py-2.5 text-center font-semibold">Batch</th>
          <th className="px-2 py-2.5 text-center font-semibold">Expiry</th>
          <th className="px-2 py-2.5 text-center font-semibold">Rack</th>
          <th className="px-2 py-2.5 text-center font-semibold">Shelf</th>
          <th className="px-2 py-2.5 text-center font-semibold">Bin</th>
          <th className="px-2 py-2.5 text-center font-semibold">Amount</th>
          <th className="w-9" />
        </tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const amount = valid(l.a) && valid(l.b) ? num(l.a) * num(l.b) : null;
            return (
              <tr key={keyOf(l)} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="max-w-[180px] break-words font-medium text-foreground">{l.productName}</div>
                  <div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}{l.brand ? ` · ` : ""}</div>
                </td>
                <td className="px-1.5 py-2">{gridCell(l.a, (v) => set(i, { a: v }), { placeholder: "0", mono: true, w: "w-16", decimal: true })}</td>
                <td className="px-1.5 py-2">{gridCell(l.b, (v) => set(i, { b: v }), { placeholder: "0", mono: true, w: "w-20", decimal: true, invalid: rateMissing(l) })}</td>
                <td className="px-1.5 py-2">{gridCell(l.batch ?? "", (v) => set(i, { batch: v }), { placeholder: "Batch", mono: true, w: "w-32" })}</td>
                <td className="px-1.5 py-2"><div className="mx-auto w-20"><MonthYearField value={l.expiry ?? ""} onChange={(v) => set(i, { expiry: v })} placeholder="Month" className="px-2" /></div></td>
                <td className="px-1.5 py-2">{gridCell(l.rack ?? "", (v) => set(i, { rack: v }), { placeholder: "Rack", w: "w-16" })}</td>
                <td className="px-1.5 py-2">{gridCell(l.shelf ?? "", (v) => set(i, { shelf: v }), { placeholder: "Shelf", w: "w-16" })}</td>
                <td className="px-1.5 py-2">{gridCell(l.bin ?? "", (v) => set(i, { bin: v }), { placeholder: "Bin", w: "w-16" })}</td>
                <td className="px-2 py-2 text-center font-mono text-muted-foreground">{amount == null ? "—" : amount.toLocaleString("en-IN")}</td>
                <td className="px-1 py-2 text-center"><button type="button" onClick={() => remove(i)} aria-label="Remove row" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Opening-stock grid — qty + an optional rate + the same batch/expiry/location columns as stock-in. */
export function OpeningGrid({ lines, set, remove }: Readonly<{
  lines: Line[]; set: (i: number, patch: Partial<Line>) => void; remove: (i: number) => void;
}>) {
  if (lines.length === 0) return <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Search a product above to add rows.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="w-[200px] px-3 py-2.5 text-left font-semibold">Product</th>
          <th className="px-2 py-2.5 text-center font-semibold">Opening qty</th>
          <th className="px-2 py-2.5 text-center font-semibold">Rate<span className="text-destructive">*</span></th>
          <th className="px-2 py-2.5 text-center font-semibold">Batch</th>
          <th className="px-2 py-2.5 text-center font-semibold">Expiry</th>
          <th className="px-2 py-2.5 text-center font-semibold">Rack</th>
          <th className="px-2 py-2.5 text-center font-semibold">Shelf</th>
          <th className="px-2 py-2.5 text-center font-semibold">Bin</th>
          <th className="px-2 py-2.5 text-center font-semibold">Value</th>
          <th className="w-9" />
        </tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const value = valid(l.a) && valid(l.b) ? num(l.a) * num(l.b) : null;
            return (
              <tr key={keyOf(l)} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="max-w-[180px] break-words font-medium text-foreground">{l.productName}</div>
                  <div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}{l.brand ? ` · ` : ""}</div>
                </td>
                <td className="px-1.5 py-2">{gridCell(l.a, (v) => set(i, { a: v }), { placeholder: "0", mono: true, w: "w-20", decimal: true })}</td>
                <td className="px-1.5 py-2">{gridCell(l.b, (v) => set(i, { b: v }), { placeholder: "0", mono: true, w: "w-20", decimal: true, invalid: rateMissing(l) })}</td>
                <td className="px-1.5 py-2">{gridCell(l.batch ?? "", (v) => set(i, { batch: v }), { placeholder: "Batch", mono: true, w: "w-32" })}</td>
                <td className="px-1.5 py-2"><div className="mx-auto w-20"><MonthYearField value={l.expiry ?? ""} onChange={(v) => set(i, { expiry: v })} placeholder="Month" className="px-2" /></div></td>
                <td className="px-1.5 py-2">{gridCell(l.rack ?? "", (v) => set(i, { rack: v }), { placeholder: "Rack", w: "w-16" })}</td>
                <td className="px-1.5 py-2">{gridCell(l.shelf ?? "", (v) => set(i, { shelf: v }), { placeholder: "Shelf", w: "w-16" })}</td>
                <td className="px-1.5 py-2">{gridCell(l.bin ?? "", (v) => set(i, { bin: v }), { placeholder: "Bin", w: "w-16" })}</td>
                <td className="px-2 py-2 text-center font-mono text-muted-foreground">{value == null ? "—" : value.toLocaleString("en-IN")}</td>
                <td className="px-1 py-2 text-center"><button type="button" onClick={() => remove(i)} aria-label="Remove row" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const REASONS = [["damage", "Damage"], ["count_correction", "Count correction"], ["write_off", "Write-off"], ["expiry", "Expiry"], ["other", "Other"]] as const;


export function LineTable({ lines, cols, render, onRemove, subRender }: Readonly<{
  lines: Line[]; cols: string[]; render: (l: Line, i: number) => React.ReactNode; onRemove: (i: number) => void;
  /** Optional compact second row under each line (e.g. GRN batch/expiry/location). */
  subRender?: (l: Line, i: number) => React.ReactNode;
}>) {
  if (lines.length === 0) return <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Search a product above to add lines.</p>;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <th className="px-3 py-2 text-left font-medium">Product</th>
          {cols.map((c) => <th key={c} className="px-3 py-2 text-right font-medium">{c}</th>)}
          <th className="w-10" />
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <Fragment key={`${l.productId}|${l.packSizeLitres}`}>
              <tr className={subRender ? "" : "border-b border-border/60 last:border-0"}>
                <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="text-xs text-muted-foreground">{packLabel(l.packSizeLitres, l.unit)}{l.brand ? ` · ` : ""}</div></td>
                <td className="px-3 py-2 text-right" colSpan={cols.length}><div className="flex items-center justify-end gap-2">{render(l, i)}</div></td>
                <td className="px-2 py-2 text-right"><button type="button" onClick={() => onRemove(i)} aria-label="Remove line" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
              </tr>
              {subRender && (
                <tr className="border-b border-border/60 last:border-0">
                  <td className="px-3 pb-2.5" colSpan={cols.length + 2}>{subRender(l, i)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
