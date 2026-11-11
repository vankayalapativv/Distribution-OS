"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { Shimmer } from "@/components/ui/shimmer";
import { litres, formatDateTime } from "@/lib/format";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { formatMonthYear } from "@/components/form/month-year-field";
import { fetchSkus, fetchStockLookup, packLabel, type LookupBatch, type MovementRow, type StockLookup } from "./stock-api";
import { SkRows } from "./stock-skeletons";

interface ProductOpt { productId: string; productName: string; brand: string | null }

const KIND: Record<MovementRow["kind"], { label: string; cls: string }> = {
  grn: { label: "Stock-in", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  opening: { label: "Opening", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  transfer_in: { label: "Transfer in", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  transfer_out: { label: "Transfer out", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  sale: { label: "Sale", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  sale_reversal: { label: "Reverse", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  adjustment: { label: "Adjust", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function Section({ title, sub, children }: Readonly<{ title: string; sub?: string; children: React.ReactNode }>) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <header className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground">
        {title}{sub && <span className="ml-2 font-medium normal-case tracking-normal text-muted-foreground/80">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

function batchLoc(b: LookupBatch): string {
  return [b.rackNo && `Rack ${b.rackNo}`, b.shelfNo && `Shelf ${b.shelfNo}`, b.binNo && `Bin ${b.binNo}`].filter(Boolean).join(" · ");
}

/** Colour for a batch row by days-to-expiry (expired/≤7 red, ≤30 amber, else muted). */
function expiryTone(dte: number | null): string {
  if (dte == null) return "text-muted-foreground";
  if (dte < 0 || dte <= 7) return "text-red-600 dark:text-red-400";
  if (dte <= 30) return "text-amber-600";
  return "text-muted-foreground";
}

/** Section-shaped shimmer mirroring the lookup body (header card + 3 sections). */
function LookupSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2"><Shimmer className="h-5 w-48" /><Shimmer className="h-3 w-28" /></div>
        <div className="space-y-2"><Shimmer className="ml-auto h-6 w-16" /><Shimmer className="ml-auto h-3 w-20" /></div>
      </div>
      <Section title="On hand by godown">
        <table className="w-full text-sm"><tbody>
          <SkRows rows={2} cells={[{ w: "w-24" }, { w: "w-10", align: "right" }, { w: "w-10", align: "right" }, { w: "w-12", align: "right" }, { w: "w-8", align: "right" }]} />
        </tbody></table>
      </Section>
      <Section title="Batches">
        <div>{[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
            <div className="min-w-0 flex-1 space-y-1.5"><Shimmer className="h-4 w-56 max-w-full" /><Shimmer className="h-3 w-28" /></div>
            <Shimmer className="h-4 w-14" /><Shimmer className="h-4 w-8" />
          </div>
        ))}</div>
      </Section>
      <Section title="Recent movements">
        <div>{[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
            <Shimmer className="h-5 w-[84px] shrink-0 rounded-full" />
            <Shimmer className="h-4 min-w-0 flex-1" />
            <Shimmer className="h-4 w-10" /><Shimmer className="h-4 w-20" />
          </div>
        ))}</div>
      </Section>
    </div>
  );
}

function LookupBody({ d }: Readonly<{ d: StockLookup }>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="text-base font-semibold text-foreground">{d.product.productName}</div>
          <div className="text-xs text-muted-foreground">{[d.product.brand, d.product.segment].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold tabular-nums text-foreground">{d.totals.qtyUnits.toLocaleString("en-IN")}</div>
          <div className="text-xs text-muted-foreground">{litres(d.totals.litres)} L on hand</div>
        </div>
      </div>

      <Section title="On hand by godown">
        {d.balances.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Not in stock at any godown.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-[11px] tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">Godown</th>
              <th className="px-3 py-2 text-right font-semibold">Pack</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Litres</th>
              <th className="px-3 py-2 text-right font-semibold">Reorder</th>
            </tr></thead>
            <tbody>
              {d.balances.map((b, i) => (
                <tr key={`${b.locationName}-${b.packSizeLitres}-${i}`} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{b.locationName}</td>
                  <td className="px-3 py-2 text-right">{packLabel(b.packSizeLitres, b.unit)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={b.belowReorder ? "font-bold text-amber-700 dark:text-amber-400" : "text-foreground"}>{b.qtyUnits}</span>
                    {b.belowReorder && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">LOW</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{litres(b.litres)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{b.reorderLevel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Batches" sub="received batch · expiry · location (advisory)">
        {d.batches.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No batch / expiry / location recorded for this product.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {d.batches.map((b) => {
              const dte = b.daysToExpiry;
              const tone = expiryTone(dte);
              return (
                <div key={b.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <span className="font-mono font-medium">{b.batchNumber ?? "—"}</span>
                      <span className="text-muted-foreground"> · {packLabel(b.packSizeLitres, b.unit)} · {b.locationName}{batchLoc(b) ? ` · ${batchLoc(b)}` : ""}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{b.source} · recd {b.receivedDate.slice(0, 10)} · {b.rate != null ? `rate ${b.rate.toLocaleString("en-IN")}` : "unpriced"}</div>
                  </div>
                  <div className={`shrink-0 text-right text-xs font-semibold ${tone}`}>
                    {b.expiryDate ? <>Exp {formatMonthYear(b.expiryDate)}{dte != null && <div className="font-mono">{dte < 0 ? `expired ${-dte}d` : `${dte}d`}</div>}</> : "No expiry"}
                  </div>
                  <div className="w-12 shrink-0 text-right font-mono text-sm">{b.qtyUnits}</div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Recent movements">
        {d.movements.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No movements yet.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {d.movements.map((m) => {
              const meta = KIND[m.kind];
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-0">
                  <span className={`inline-block w-[84px] shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                  <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{m.locationName}{m.note ? ` · ${m.note}` : ""}</div>
                  <span className={`w-12 shrink-0 text-right font-mono text-sm font-semibold ${m.qtyUnits < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{m.qtyUnits > 0 ? "+" : ""}{m.qtyUnits}</span>
                  <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">{formatDateTime(m.movedAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

export function StockLookupDialog({ actionConfig, onClose }: Readonly<{ actionConfig: ActionConfig; onClose: () => void }>) {
  const [productId, setProductId] = useState("");
  const skusQ = useQuery({ queryKey: ["stock-skus-all"], queryFn: () => fetchSkus(actionConfig, ""), staleTime: 60_000 });
  const products = useMemo<ProductOpt[]>(() => {
    const m = new Map<string, ProductOpt>();
    for (const s of skusQ.data ?? []) if (!m.has(s.productId)) m.set(s.productId, { productId: s.productId, productName: s.productName, brand: s.brand });
    return [...m.values()].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [skusQ.data]);

  const lookupQ = useQuery({ queryKey: ["stock-lookup", productId], queryFn: () => fetchStockLookup(actionConfig, productId), enabled: Boolean(productId) });

  let panel: ReactNode = null;
  if (!productId) {
    panel = <p className="py-10 text-center text-sm text-muted-foreground">Pick a product to see its stock.</p>;
  } else if (lookupQ.isLoading) {
    panel = <LookupSkeleton />;
  } else if (lookupQ.error) {
    panel = <p className="text-sm font-medium text-destructive">{errorMessage(lookupQ.error, "Could not load the lookup.")}</p>;
  } else if (lookupQ.data) {
    panel = <LookupBody d={lookupQ.data} />;
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Stock lookup</DialogTitle>
          <DialogDescription>Check on-hand, batches and recent movements for any product.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <SearchSelect
            items={products} valueKey={productId} getKey={(p) => p.productId} getLabel={(p) => p.productName} onSelect={setProductId}
            placeholder={skusQ.isLoading ? "Loading products…" : "Search a product…"} searchPlaceholder="Search a product…" emptyText="No products found" contentClassName="w-[420px] p-0"
            renderOption={(p) => (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{p.productName}</span>
                {p.brand && <span className="truncate text-xs text-muted-foreground">{p.brand}</span>}
              </span>
            )}
          />

          {panel}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
