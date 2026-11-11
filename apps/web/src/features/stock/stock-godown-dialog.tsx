"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Droplet } from "lucide-react";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Shimmer } from "@/components/ui/shimmer";
import { litres, plural } from "@/lib/format";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { fetchBalances, fetchGodownBreakdown, packLabel, type BalanceRow, type GodownBreakdownRow } from "./stock-api";
import { SkRows } from "./stock-skeletons";

/** Which stat card opened the per-godown breakdown (sets the emphasised column). */
export type GodownMetric = "skus" | "litres";

function num(n: number) { return n.toLocaleString("en-IN"); }

function BreakdownTable({ rows, metric, loading }: Readonly<{ rows: GodownBreakdownRow[]; metric: GodownMetric; loading: boolean }>) {
  const totals = rows.reduce((a, r) => ({ skuCount: a.skuCount + r.skuCount, units: a.units + r.units, litres: a.litres + r.litres }), { skuCount: 0, units: 0, litres: 0 });
  const hot = (col: GodownMetric) => (col === metric ? "font-bold text-foreground" : "text-muted-foreground");
  if (!loading && rows.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No godowns yet.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 text-left font-semibold">Godown</th>
          <th className="px-3 py-2.5 text-right font-semibold">SKUs</th>
          <th className="px-3 py-2.5 text-right font-semibold">Units</th>
          <th className="px-4 py-2.5 text-right font-semibold">Litres</th>
        </tr></thead>
        <tbody>
          {loading ? <SkRows rows={2} cells={[{ w: "w-28" }, { w: "w-8", align: "right" }, { w: "w-10", align: "right" }, { w: "w-14", align: "right" }]} /> : rows.map((r) => (
            <tr key={r.locationId} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-2.5 font-medium text-foreground">{r.locationName}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${hot("skus")}`}>{r.skuCount ? num(r.skuCount) : "—"}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{r.units ? num(r.units) : "—"}</td>
              <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${hot("litres")}`}>{r.litres ? litres(r.litres) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-border bg-muted/30 font-semibold">
          <td className="px-4 py-2.5 text-xs tracking-wide text-muted-foreground">All godowns</td>
          {loading ? (
            <>
              <td className="px-3 py-2.5"><Shimmer className="ml-auto h-4 w-8" /></td>
              <td className="px-3 py-2.5"><Shimmer className="ml-auto h-4 w-10" /></td>
              <td className="px-4 py-2.5"><Shimmer className="ml-auto h-4 w-16" /></td>
            </>
          ) : (
            <>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${hot("skus")}`}>{num(totals.skuCount)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">{num(totals.units)}</td>
              <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${hot("litres")}`}>{litres(totals.litres)} L</td>
            </>
          )}
        </tr></tfoot>
      </table>
    </div>
  );
}

export function GodownBreakdownDialog({ actionConfig, metric, onClose }: Readonly<{ actionConfig: ActionConfig; metric: GodownMetric; onClose: () => void }>) {
  const q = useQuery({ queryKey: ["stock-by-godown"], queryFn: () => fetchGodownBreakdown(actionConfig) });
  const Icon = metric === "litres" ? Droplet : Boxes;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Icon className="size-4 text-sky-500" />{metric === "litres" ? "Total litres by godown" : "SKUs in stock by godown"}</DialogTitle>
          <DialogDescription>On-hand stock broken down across each godown.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {q.error ? <p className="text-sm font-medium text-destructive">{errorMessage(q.error, "Could not load the breakdown.")}</p>
            : <BreakdownTable rows={q.data ?? []} metric={metric} loading={q.isLoading} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function LowStockList({ rows, loading }: Readonly<{ rows: BalanceRow[]; loading: boolean }>) {
  if (!loading && rows.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing below its reorder level. 🎉</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-amber-300 dark:border-amber-900/50">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-amber-200 bg-amber-50 text-[11px] tracking-wide text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <th className="px-4 py-2.5 text-left font-semibold">SKU</th>
          <th className="px-3 py-2.5 text-left font-semibold">Godown</th>
          <th className="px-3 py-2.5 text-right font-semibold">On hand</th>
          <th className="px-4 py-2.5 text-right font-semibold">Reorder</th>
        </tr></thead>
        <tbody>
          {loading && <SkRows rows={3} cells={[{ w: "w-40", stack: "w-20" }, { w: "w-24" }, { w: "w-10", align: "right" }, { w: "w-10", align: "right" }]} />}
          {!loading && rows.map((r) => (
            <tr key={`${r.locationId}|${r.productId}|${r.packSizeLitres}`} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.productName}</div><div className="text-xs text-muted-foreground">{packLabel(r.packSizeLitres, r.unit)}{r.brand ? ` · ${r.brand}` : ""}</div></td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.locationName}</td>
              <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-amber-700 dark:text-amber-400">{r.qtyUnits}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{r.reorderLevel ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LowStockDialog({ actionConfig, locationId, onClose }: Readonly<{ actionConfig: ActionConfig; locationId?: string; onClose: () => void }>) {
  const q = useQuery({
    queryKey: ["stock-low-stock", locationId ?? ""],
    queryFn: () => fetchBalances(actionConfig, { locationId, lowOnly: true, page: 1, pageSize: 100 }),
  });
  const rows = q.data?.rows ?? [];
  const verb = rows.length === 1 ? "needs" : "need";
  const desc = q.data ? `${rows.length} SKU${plural(rows.length)} ${verb} restocking.` : "SKUs with on-hand below their reorder level.";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Below reorder level</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {q.error ? <p className="text-sm font-medium text-destructive">{errorMessage(q.error, "Could not load low stock.")}</p>
            : <LowStockList rows={rows} loading={q.isLoading} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
