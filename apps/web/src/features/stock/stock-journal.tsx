"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Boxes, Droplet, MoreVertical, PackageOpen, Pencil, Plus } from "lucide-react";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shimmer } from "@/components/ui/shimmer";
import { litres, rupees, formatDate, plural } from "@/lib/format";
import { formatMonthYear } from "@/components/form/month-year-field";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import {
  createLocation, fetchAdjustments, fetchBalances, fetchBalancesSummary, fetchGrns, fetchInvoiceActivity, fetchLocations,
  fetchNearExpiry, fetchTransfers, packLabel, setReorder,
  type AdjustmentDoc, type BalanceRow, type BalancesSummary, type GrnDoc, type InvoiceActivityRow, type NearExpiryRow, type TransferDoc,
} from "./stock-api";
import { StockDocDetailDialog, type DocRef } from "./stock-doc-detail";
import { StockLookupDialog } from "./stock-lookup-dialog";
import { GodownBreakdownDialog, LowStockDialog, type GodownMetric } from "./stock-godown-dialog";
import { ActivitySkeleton, SkRows } from "./stock-skeletons";
import { InvoiceStockDetailDialog, type InvoiceStockRef } from "./stock-invoice-detail";

type Role = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";
/** Stock home is a dashboard; "View all" drills into one full list. */
type View = "home" | "balances" | "activity" | "near-expiry";
const PAGE = 10;
const REASON_LABEL: Record<string, string> = { damage: "Damage", count_correction: "Count correction", write_off: "Write-off", expiry: "Expiry", other: "Other" };
/** Right-aligned hint text for each drill-down view's toolbar. */
const TOOLBAR_HINT: Record<View, string> = {
  home: "Your stock at a glance",
  balances: "On hand = sum of the ledger",
  activity: "Newest first · click a row for its document",
  "near-expiry": "Soonest to expire first",
};

// ── Compact KPI row — every card opens a drill-down popup ──
const KPI_CARD = "rounded-xl border p-4 text-left transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function KpiRow({ summary, loading, scope, onGodown, onLow }: Readonly<{
  summary: BalancesSummary | undefined; loading: boolean; scope: string; onGodown: (m: GodownMetric) => void; onLow: () => void;
}>) {
  const below = summary?.belowReorder ?? 0;
  const busy = loading || !summary;
  let belowHint = "nothing low";
  if (busy) belowHint = "checking reorder levels";
  else if (below > 0) belowHint = "SKUs need restocking · tap to list";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <button type="button" onClick={() => onGodown("skus")} className={`${KPI_CARD} border-border bg-card`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground"><Boxes className="size-3.5" />SKUs in stock</div>
        <div className="mt-1.5 h-8 text-2xl font-bold tabular-nums">{busy ? <Shimmer className="mt-1 h-7 w-16" /> : summary.skuCount.toLocaleString("en-IN")}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{scope} · tap for split</div>
      </button>
      <button type="button" onClick={() => onGodown("litres")} className={`${KPI_CARD} border-border bg-card`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-sky-500"><Droplet className="size-3.5" />Total litres</div>
        <div className="mt-1.5 h-8 text-2xl font-bold tabular-nums">{busy ? <Shimmer className="mt-1 h-7 w-24" /> : <>{litres(summary.totalLitres)}<span className="ml-1 text-sm font-medium text-muted-foreground">L</span></>}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">on hand · tap for each godown</div>
      </button>
      <button type="button" onClick={onLow} className={`${KPI_CARD} ${below > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-border bg-card"}`}>
        <div className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide ${below > 0 ? "text-amber-600" : "text-muted-foreground"}`}><AlertTriangle className="size-3.5" />Below reorder</div>
        <div className="mt-1.5 h-8 text-2xl font-bold tabular-nums">{busy ? <Shimmer className="mt-1 h-7 w-10" /> : <span className={below > 0 ? "text-amber-700 dark:text-amber-400" : ""}>{below.toLocaleString("en-IN")}</span>}</div>
        <div className={`mt-0.5 text-xs ${below > 0 ? "text-amber-700/70 dark:text-amber-400/70" : "text-muted-foreground"}`}>{belowHint}</div>
      </button>
    </div>
  );
}

// ── A dashboard section card with a header + optional "View all" ──
function Section({ title, sub, action, warned, children }: Readonly<{
  title: string; sub?: string; action?: React.ReactNode; warned?: boolean; children: React.ReactNode;
}>) {
  return (
    <section className={`overflow-hidden rounded-xl border ${warned ? "border-amber-300 dark:border-amber-900/50" : "border-border"}`}>
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${warned ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20" : "border-border bg-card"}`}>
        <div className="text-sm font-bold">
          <span className={warned ? "text-amber-700 dark:text-amber-400" : "text-foreground"}>{title}</span>
          {sub && <span className="ml-2 text-xs font-medium text-muted-foreground">{sub}</span>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ViewAll({ onClick, label }: Readonly<{ onClick: () => void; label: string }>) {
  return <button type="button" onClick={onClick} className="whitespace-nowrap text-xs font-semibold text-primary hover:underline">{label} →</button>;
}

/** Severity styling for an expiry row by days-to-expiry (expired/≤7 red, ≤30 amber). */
function expirySeverity(d: number): { stripe: string; txt: string } {
  if (d < 0 || d <= 7) return { stripe: "bg-red-500", txt: "text-red-600 dark:text-red-400" };
  if (d <= 30) return { stripe: "bg-amber-500", txt: "text-amber-600" };
  return { stripe: "bg-border", txt: "text-muted-foreground" };
}

// Shared 6-column grid for the three home cards, so columns line up vertically across all cards.
// Widths: wide name col · medium middle cols · compact right-hand columns.
const HOME_COLS = ["w-[28%]", "w-[13%]", "w-[15%]", "w-[18%]", "w-[13%]", "w-[13%]"] as const;
function HomeColGroup() {
  // Static, fixed-length column set — index keys are stable here.
  return <colgroup>{HOME_COLS.map((c, i) => <col key={i} className={c} />)}</colgroup>;
}

// ── Expiring-soon table (home card, Design A: dense, amber) ──
function ExpiringList({ rows, loading, limit }: Readonly<{ rows: NearExpiryRow[]; loading: boolean; limit?: number }>) {
  if (!loading && rows.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No stock with an expiry date yet. Add batch/expiry when recording stock-in or opening.</p>;
  const show = limit ? rows.slice(0, limit) : rows;
  return (
    <table className="w-full table-fixed text-sm">
      <HomeColGroup />
      <thead>
        <tr className="border-b border-amber-200 bg-amber-50/70 text-[10px] uppercase tracking-wide text-amber-700/80 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400/70">
          <th className="px-4 py-2 text-left font-semibold">Product</th>
          <th className="px-3 py-2 text-left font-semibold">Batch</th>
          <th className="px-3 py-2 text-left font-semibold">Expiry</th>
          <th className="px-3 py-2 text-left font-semibold">Location</th>
          <th className="px-3 py-2 text-center font-semibold">Days left</th>
          <th className="px-4 py-2 text-center font-semibold">On hand</th>
        </tr>
      </thead>
      <tbody>
        {loading && <SkRows rows={limit ?? 5} cells={[{ w: "w-40", stack: "w-20" }, { w: "w-14" }, { w: "w-16" }, { w: "w-20" }, { w: "w-12", align: "right" }, { w: "w-10", align: "right" }]} />}
        {!loading && show.map((r) => {
          const d = r.daysToExpiry;
          const { txt } = expirySeverity(d);
          return (
            <tr key={r.id} className="border-b border-amber-200/70 last:border-0 hover:bg-amber-50/60 dark:border-amber-900/30 dark:hover:bg-amber-950/20">
              <td className="px-4 py-2.5">
                <div className="truncate font-semibold text-foreground">{r.productName}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{packLabel(r.packSizeLitres, r.unit)}{r.rate != null ? ` · rate ${r.rate.toLocaleString("en-IN")}` : ""}</div>
              </td>
              <td className="truncate px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.batchNumber || "—"}</td>
              <td className="truncate px-3 py-2.5 text-muted-foreground">{formatMonthYear(r.expiryDate)}</td>
              <td className="truncate px-3 py-2.5 text-muted-foreground">{r.locationName}</td>
              <td className="px-3 py-2.5 text-center">
                <span className={`font-mono text-[13px] font-bold tabular-nums ${txt}`}>{d < 0 ? `exp ${-d}d` : `${d}d`}</span>
              </td>
              <td className="px-4 py-2.5 text-center"><span className="font-mono text-base font-extrabold tabular-nums text-amber-700 dark:text-amber-400">{r.onHandQty.toLocaleString("en-IN")}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Unified activity feed: GRN + transfer + adjustment + invoice (sale/reversal), newest first ──
// `secondary` is the composed one-line detail (used by the full-history ActivityFeed, kept
// identical); `detail`/`locationName`/`amount` are the same data split out for the Design-A
// home table's columns. secondary === [detail, locationName, amount].filter(Boolean).join(" · ").
interface ActivityItem { id: string; kind: "grn" | "transfer" | "adjustment" | "sale" | "reversal" | "return"; refId: string; docNumber: string; date: string; primary: string; secondary: string; detail: string; locationName: string; amount?: string }
/** The detail a row opens: a stock doc (grn/transfer/adjustment) or an invoice stock event (sale/reversal/return). */
export type ActivityRef = { kind: ActivityItem["kind"]; id: string };
const ACT_META: Record<ActivityItem["kind"], { label: string; cls: string }> = {
  grn: { label: "Stock-in", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  transfer: { label: "Transfer", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  adjustment: { label: "Adjust", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  sale: { label: "Sale", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  reversal: { label: "Reversal", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  return: { label: "Return", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
};

function useActivity(actionConfig: ActionConfig, locationId: string, size: number, enabled: boolean) {
  const loc = locationId || undefined;
  const g = useQuery({ queryKey: ["stock-grns", locationId, size], queryFn: () => fetchGrns(actionConfig, { locationId: loc, page: 1, pageSize: size }), enabled });
  const t = useQuery({ queryKey: ["stock-transfers", locationId, size], queryFn: () => fetchTransfers(actionConfig, { locationId: loc, page: 1, pageSize: size }), enabled });
  const a = useQuery({ queryKey: ["stock-adjustments", locationId, size], queryFn: () => fetchAdjustments(actionConfig, { locationId: loc, page: 1, pageSize: size }), enabled });
  const s = useQuery({ queryKey: ["stock-invoice-activity", locationId, size], queryFn: () => fetchInvoiceActivity(actionConfig, { locationId: loc, limit: size }), enabled });
  const items = useMemo<ActivityItem[]>(() => {
    const line = (n: number) => `${n} line${plural(n)}`;
    const units = (n: number) => `${n.toLocaleString("en-IN")} unit${plural(n)}`;
    // Build each row from split parts, then derive secondary so it stays byte-identical.
    const mk = (base: Omit<ActivityItem, "secondary">): ActivityItem => ({
      ...base,
      secondary: [base.detail, base.locationName, base.amount].filter(Boolean).join(" · "),
    });
    const merged: ActivityItem[] = [
      ...(g.data?.rows ?? []).map((r: GrnDoc) => mk({ id: r.id, refId: r.id, kind: "grn" as const, docNumber: r.docNumber, date: r.date, primary: r.party, detail: line(r.lineCount), locationName: r.locationName, amount: rupees(r.value) })),
      ...(t.data?.rows ?? []).map((r: TransferDoc) => mk({ id: r.id, refId: r.id, kind: "transfer" as const, docNumber: r.docNumber, date: r.date, primary: r.route, detail: line(r.lineCount), locationName: "" })),
      ...(a.data?.rows ?? []).map((r: AdjustmentDoc) => mk({ id: r.id, refId: r.id, kind: "adjustment" as const, docNumber: r.docNumber, date: r.date, primary: REASON_LABEL[r.reason] ?? r.reason, detail: line(r.lineCount), locationName: r.locationName })),
      ...(s.data ?? []).map((r: InvoiceActivityRow) => {
        const detail = r.kind === "sale" ? units(r.units) : r.kind === "return" ? `${units(r.units)} returned` : `${units(r.units)} credited`;
        const amount = r.kind === "sale" && r.value != null ? rupees(r.value) : undefined;
        return mk({ id: `${r.invoiceId}-${r.kind}`, refId: r.invoiceId, kind: r.kind, docNumber: r.invoiceNumber, date: r.movedAt.slice(0, 10), primary: r.customerName ?? "Walk-in", detail, locationName: r.locationName, amount });
      }),
    ];
    merged.sort((x, y) => y.date.localeCompare(x.date) || y.docNumber.localeCompare(x.docNumber));
    return merged;
  }, [g.data, t.data, a.data, s.data]);
  return { items, loading: g.isLoading || t.isLoading || a.isLoading || s.isLoading };
}

function ActivityFeed({ items, loading, onDetail, limit }: Readonly<{ items: ActivityItem[]; loading: boolean; onDetail: (d: ActivityRef) => void; limit?: number }>) {
  if (loading) return <ActivitySkeleton rows={limit ?? 6} />;
  if (items.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No stock documents yet. Record a stock-in, transfer or adjustment.</p>;
  const show = limit ? items.slice(0, limit) : items;
  return (
    <div>
      {show.map((it) => {
        const m = ACT_META[it.kind];
        return (
          <button key={it.id} type="button" onClick={() => onDetail({ kind: it.kind, id: it.refId })} className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-accent/50">
            <span className={`inline-block w-[70px] shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${m.cls}`}>{m.label}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">{it.primary} <span className="font-mono text-xs text-muted-foreground">{it.docNumber}</span></div>
              <div className="truncate text-xs text-muted-foreground">{it.secondary}</div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDate(it.date)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Recent-activity table (home card, Design A: dense; value in its own column) ──
function HomeActivityTable({ items, loading, onDetail, limit }: Readonly<{ items: ActivityItem[]; loading: boolean; onDetail: (d: ActivityRef) => void; limit?: number }>) {
  if (!loading && items.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No stock documents yet. Record a stock-in, transfer or adjustment.</p>;
  const show = limit ? items.slice(0, limit) : items;
  return (
    <table className="w-full table-fixed text-sm">
      <HomeColGroup />
      <thead>
        <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2 text-left font-semibold">Type</th>
          <th className="px-3 py-2 text-left font-semibold">Party</th>
          <th className="px-3 py-2 text-left font-semibold">Doc</th>
          <th className="px-3 py-2 text-left font-semibold">Location</th>
          <th className="px-3 py-2 text-center font-semibold">Value</th>
          <th className="px-4 py-2 text-center font-semibold">Date</th>
        </tr>
      </thead>
      <tbody>
        {loading && <SkRows rows={limit ?? 6} cells={[{ w: "w-16" }, { w: "w-24" }, { w: "w-20" }, { w: "w-20" }, { w: "w-16", align: "right" }, { w: "w-20", align: "right" }]} />}
        {!loading && show.map((it) => {
          const m = ACT_META[it.kind];
          return (
            <tr key={it.id} onClick={() => onDetail({ kind: it.kind, id: it.refId })} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/40">
              <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ${m.cls}`}>{m.label}</span></td>
              <td className="truncate px-3 py-2.5 font-medium text-foreground">{it.primary}</td>
              <td className="truncate px-3 py-2.5 font-mono text-xs text-muted-foreground">{it.docNumber}</td>
              <td className="truncate px-3 py-2.5 text-muted-foreground">{it.locationName || "—"}</td>
              <td className="px-3 py-2.5 text-center">{it.amount ? <span className="font-mono text-base font-extrabold tabular-nums text-foreground">{it.amount}</span> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-2.5 text-center whitespace-nowrap text-muted-foreground">{formatDate(it.date)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Full on-hand balances table (the "View all" drill-down) ──
function EmptyStock({ filtered, canWrite, onOpening, onGrn }: Readonly<{ filtered: boolean; canWrite: boolean; onOpening: () => void; onGrn: () => void }>) {
  if (filtered) return <p className="py-4 text-center text-sm text-muted-foreground">No SKUs match these filters.</p>;
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <PackageOpen className="size-9 text-muted-foreground/50" />
      <h3 className="mt-3 text-sm font-semibold text-foreground">No stock recorded yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Seed on-hand by recording opening stock at go-live, or record stock-in when goods arrive.</p>
      {canWrite && <div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={onOpening}>Opening stock</Button><Button onClick={onGrn}>Record stock-in</Button></div>}
    </div>
  );
}

function BalancesTable({ rows, loading, canWrite, onEditReorder, filtered, onOpening, onGrn, skeletonRows = 6 }: Readonly<{
  rows: BalanceRow[]; loading: boolean; canWrite: boolean; onEditReorder: (r: BalanceRow) => void; filtered: boolean; onOpening: () => void; onGrn: () => void; skeletonRows?: number;
}>) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-xs tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 text-left font-semibold">SKU</th>
          <th className="px-4 py-2.5 text-left font-semibold">Godown</th>
          <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
          <th className="px-4 py-2.5 text-right font-semibold">Litres</th>
          <th className="px-4 py-2.5 text-right font-semibold">Reorder</th>
        </tr>
      </thead>
      <tbody>
        {(() => {
          if (loading) {
            return <SkRows rows={skeletonRows} cells={[{ w: "w-40", stack: "w-24" }, { w: "w-28" }, { w: "w-10", align: "right" }, { w: "w-12", align: "right" }, { w: "w-8", align: "right" }]} />;
          }
          if (rows.length === 0) {
            return <tr><td colSpan={5} className="px-4 py-8"><EmptyStock filtered={filtered} canWrite={canWrite} onOpening={onOpening} onGrn={onGrn} /></td></tr>;
          }
          return rows.map((r) => (
            <tr key={`${r.locationId}|${r.productId}|${r.packSizeLitres}`} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
              <td className="px-4 py-2.5">
                <div className="font-medium text-foreground">{r.productName}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{packLabel(r.packSizeLitres, r.unit)}</span>
                  {r.brand && <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">{r.brand}</span>}
                  {r.segment && <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">{r.segment}</span>}
                </div>
              </td>
              <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="size-1.5 rounded-full bg-muted-foreground/40" />{r.locationName}</span></td>
              <td className="px-4 py-2.5 text-right font-mono">
                <span className={r.belowReorder ? "font-bold text-amber-700" : "text-foreground"}>{r.qtyUnits}</span>
                {r.belowReorder && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">LOW</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground">{litres(r.litres)}</td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-mono text-muted-foreground">{r.reorderLevel ?? "—"}</span>
                  {canWrite && <button type="button" onClick={() => onEditReorder(r)} aria-label="Set reorder level" className="text-muted-foreground/60 hover:text-foreground"><Pencil className="size-3.5" /></button>}
                </div>
              </td>
            </tr>
          ));
        })()}
      </tbody>
    </table>
  );
}

// ── On-hand table (home card, Design A: dense; reorder pencil on row hover; brand only, no segment) ──
function HomeBalances({ rows, loading, canWrite, onEditReorder, onOpening, onGrn }: Readonly<{
  rows: BalanceRow[]; loading: boolean; canWrite: boolean; onEditReorder: (r: BalanceRow) => void; onOpening: () => void; onGrn: () => void;
}>) {
  return (
    <table className="w-full table-fixed text-sm">
      <HomeColGroup />
      <thead>
        <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2 text-left font-semibold">SKU</th>
          <th className="px-3 py-2 text-left font-semibold">Brand</th>
          <th className="px-3 py-2 text-left font-semibold">Godown</th>
          <th className="px-3 py-2 text-center font-semibold">Qty</th>
          <th className="px-3 py-2 text-center font-semibold">Litres</th>
          <th className="px-4 py-2 text-center font-semibold">Reorder</th>
        </tr>
      </thead>
      <tbody>
        {(() => {
          if (loading) {
            return <SkRows rows={6} cells={[{ w: "w-40", stack: "w-16" }, { w: "w-14" }, { w: "w-24" }, { w: "w-10", align: "right" }, { w: "w-12", align: "right" }, { w: "w-8", align: "right" }]} />;
          }
          if (rows.length === 0) {
            return <tr><td colSpan={6} className="px-4 py-8"><EmptyStock filtered={false} canWrite={canWrite} onOpening={onOpening} onGrn={onGrn} /></td></tr>;
          }
          return rows.map((r) => (
            <tr key={`${r.locationId}|${r.productId}|${r.packSizeLitres}`} className="group border-b border-border/60 last:border-0 hover:bg-accent/40">
              <td className="px-4 py-2.5">
                <div className="truncate font-semibold text-foreground">{r.productName}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{packLabel(r.packSizeLitres, r.unit)}</div>
              </td>
              <td className="truncate px-3 py-2.5">
                {r.brand ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{r.brand}</span> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="truncate px-3 py-2.5 text-muted-foreground">{r.locationName}</td>
              <td className="px-3 py-2.5 text-center">
                <span className={`font-mono text-base font-extrabold tabular-nums ${r.belowReorder ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{r.qtyUnits}</span>
                {r.belowReorder && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">LOW</span>}
              </td>
              <td className="px-3 py-2.5 text-center"><span className="font-mono text-base font-extrabold tabular-nums text-sky-600 dark:text-sky-400">{litres(r.litres)}</span></td>
              <td className="relative px-4 py-2.5 text-center">
                <span className="font-mono text-muted-foreground">{r.reorderLevel ?? "—"}</span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => onEditReorder(r)}
                    aria-label={r.reorderLevel == null ? "Set reorder level" : "Edit reorder level"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ));
        })()}
      </tbody>
    </table>
  );
}

// ── Full near-expiry table (drill-down) ──
/** Days-left cell colour in the full near-expiry table (expired red, ≤30 amber). */
function nearExpiryTone(d: number): string {
  if (d < 0) return "text-destructive font-semibold";
  if (d <= 30) return "text-amber-600 font-semibold";
  return "text-foreground";
}

function NearExpiryTable({ rows, loading }: Readonly<{ rows: NearExpiryRow[]; loading: boolean }>) {
  if (!loading && rows.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted-foreground">No stock with an expiry date recorded yet. Add batch/expiry details when recording stock-in.</p>;
  const locParts = (r: NearExpiryRow) => [r.rackNo && `Rack ${r.rackNo}`, r.shelfNo && `Shelf ${r.shelfNo}`, r.binNo && `Bin ${r.binNo}`].filter(Boolean).join(" · ");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <th className="px-4 py-2.5 text-left font-medium">Product</th>
          <th className="px-3 py-2.5 text-left font-medium">Batch</th>
          <th className="px-3 py-2.5 text-right font-medium">Rate</th>
          <th className="px-3 py-2.5 text-left font-medium">Expiry</th>
          <th className="px-3 py-2.5 text-right font-medium">Days left</th>
          <th className="px-3 py-2.5 text-right font-medium">On hand</th>
          <th className="px-3 py-2.5 text-left font-medium">Location</th>
          <th className="px-3 py-2.5 text-left font-medium">Source</th>
        </tr></thead>
        <tbody>
          {loading && <SkRows rows={8} cells={[{ w: "w-40", stack: "w-20" }, { w: "w-16" }, { w: "w-12", align: "right" }, { w: "w-20" }, { w: "w-10", align: "right" }, { w: "w-12", align: "right" }, { w: "w-24", stack: "w-16" }, { w: "w-20" }]} />}
          {!loading && rows.map((r) => {
            const d = r.daysToExpiry;
            const tone = nearExpiryTone(d);
            return (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.productName}</div><div className="text-xs text-muted-foreground">{packLabel(r.packSizeLitres, r.unit)}{r.brand ? ` · ${r.brand}` : ""}</div></td>
                <td className="px-3 py-2.5 font-mono text-xs">{r.batchNumber ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{r.rate != null ? r.rate.toLocaleString("en-IN") : "—"}</td>
                <td className="px-3 py-2.5">{formatMonthYear(r.expiryDate)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${tone}`}>{d < 0 ? `expired ${-d}d` : `${d}d`}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.onHandQty.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2.5"><div>{r.locationName}</div>{locParts(r) && <div className="text-xs text-muted-foreground">{locParts(r)}</div>}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.grnNumber}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReorderDialog({ actionConfig, row, onClose, onDone }: Readonly<{ actionConfig: ActionConfig; row: BalanceRow; onClose: () => void; onDone: () => void }>) {
  const [value, setValue] = useState(row.reorderLevel == null ? "" : String(row.reorderLevel));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (clear: boolean) => {
    setBusy(true); setError(null);
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    // Don't let a non-numeric entry serialize to NaN → null and silently CLEAR
    // the reorder level; require a valid number ≥ 0 (or use the Clear action).
    if (!clear && trimmed !== "" && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a valid reorder level (a number of 0 or more), or clear it.");
      setBusy(false);
      return;
    }
    try {
      await setReorder(actionConfig, { locationId: row.locationId, productId: row.productId, packSizeLitres: row.packSizeLitres, reorderLevel: clear || trimmed === "" ? null : parsed });
      onDone();
    } catch (e) { setError(errorMessage(e, "Could not save the reorder level.")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Reorder level</DialogTitle><DialogDescription>{row.productName} · {packLabel(row.packSizeLitres, row.unit)} · {row.locationName}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-1.5">
          <Label className="text-xs">Alert when on-hand falls below (units)</Label>
          <Input inputMode="decimal" value={value} placeholder="e.g. 20" onChange={(e) => setValue(e.target.value)} className="font-mono" />
          <p className="text-xs text-muted-foreground">On-hand below this flags the SKU in amber and appears under “Low stock only”.</p>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => save(true)} disabled={busy || row.reorderLevel == null}>Clear</Button>
          <div className="flex gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyGodowns({ canWrite, onAdd }: Readonly<{ canWrite: boolean; onAdd: () => void }>) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <Boxes className="size-10 text-muted-foreground/50" />
      <h2 className="mt-4 text-base font-semibold text-foreground">No godowns yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add a godown to start tracking stock. Then record opening stock or stock-in to seed on-hand quantities.</p>
      {canWrite && <Button className="mt-5" onClick={onAdd}><Plus className="size-4" />Add a godown</Button>}
    </div>
  );
}

function AddGodownDialog({ actionConfig, onClose, onDone }: Readonly<{ actionConfig: ActionConfig; onClose: () => void; onDone: () => void }>) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await createLocation(actionConfig, { name: name.trim(), code: code.trim() || null, city: city.trim() || null, stateCode: "36", isDefault: true });
      onDone();
    } catch (e) { setError(errorMessage(e, "Could not add the godown.")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Add a godown</DialogTitle><DialogDescription>A stock location under your Telangana GSTIN.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Godown — Kukatpally" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Short code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KKP" /></div>
            <div className="space-y-1.5"><Label className="text-xs">City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Hyderabad" /></div>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || name.trim() === ""}>{busy ? "Saving…" : "Add godown"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Single ⋮ kebab → the stock actions beside the primary Record stock-in (write roles). */
function StockActionsMenu({ onPick }: Readonly<{ onPick: (t: string) => void }>) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent";
  const pick = (t: string) => () => { setOpen(false); onPick(t); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger title="More stock actions" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <MoreVertical className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-44 gap-0.5 p-1.5">
        <button type="button" className={item} onClick={pick("opening")}>Opening stock</button>
        <button type="button" className={item} onClick={pick("transfer")}>Transfer stock</button>
        <button type="button" className={item} onClick={pick("adjust")}>Adjust stock</button>
      </PopoverContent>
    </Popover>
  );
}

/** Page-header controls: Stock lookup · godown filter · Record stock-in · ⋮. */
function StockHeaderActions({ loading, locations, locationId, canWrite, onGodown, onLookup, onEntry }: Readonly<{
  loading: boolean; locations: readonly { id: string; name: string }[]; locationId: string; canWrite: boolean;
  onGodown: (v: string) => void; onLookup: () => void; onEntry: (t: string) => void;
}>) {
  const items = loading ? [{ id: "", name: "Loading…" }] : [{ id: "", name: "All godowns" }, ...locations.map((l) => ({ id: l.id, name: l.name }))];
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onLookup} disabled={loading}>Stock lookup</Button>
      <div className="w-[180px]">
        <SearchSelect
          items={items} valueKey={locationId} getKey={(x) => x.id} getLabel={(x) => x.name}
          onSelect={onGodown} disabled={loading}
          placeholder="All godowns" searchPlaceholder="Search godown…" emptyText="No godowns found" contentClassName="w-[220px] p-0"
        />
      </div>
      {canWrite && <Button onClick={() => onEntry("in")}>Record stock-in</Button>}
      {canWrite && <StockActionsMenu onPick={onEntry} />}
    </div>
  );
}

/** All of the Stock page's modal dialogs, driven by the parent's open-state. */
function StockDialogs({
  actionConfig, loc, addOpen, onAddClose, onAddDone, reorderRow, onReorderClose, onReorderDone,
  detailDoc, onDetailClose, lookupOpen, onLookupClose, godownMetric, onGodownClose, lowOpen, onLowClose,
}: Readonly<{
  actionConfig: ActionConfig; loc: string | undefined;
  addOpen: boolean; onAddClose: () => void; onAddDone: () => void;
  reorderRow: BalanceRow | null; onReorderClose: () => void; onReorderDone: () => void;
  detailDoc: DocRef | null; onDetailClose: () => void;
  lookupOpen: boolean; onLookupClose: () => void;
  godownMetric: GodownMetric | null; onGodownClose: () => void;
  lowOpen: boolean; onLowClose: () => void;
}>) {
  return (
    <>
      {addOpen && <AddGodownDialog actionConfig={actionConfig} onClose={onAddClose} onDone={onAddDone} />}
      {reorderRow && <ReorderDialog actionConfig={actionConfig} row={reorderRow} onClose={onReorderClose} onDone={onReorderDone} />}
      {detailDoc && <StockDocDetailDialog actionConfig={actionConfig} doc={detailDoc} onClose={onDetailClose} />}
      {lookupOpen && <StockLookupDialog actionConfig={actionConfig} onClose={onLookupClose} />}
      {godownMetric && <GodownBreakdownDialog actionConfig={actionConfig} metric={godownMetric} onClose={onGodownClose} />}
      {lowOpen && <LowStockDialog actionConfig={actionConfig} locationId={loc} onClose={onLowClose} />}
    </>
  );
}

function StockJournalInner({ role, actionConfig }: { readonly role: Role; readonly actionConfig: ActionConfig }) {
  const qc = useQueryClient();
  const router = useRouter();
  const goEntry = (t: string) => router.push(`/stock/entry?type=${t}`);
  const [view, setView] = useState<View>("home");
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [reorderRow, setReorderRow] = useState<BalanceRow | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocRef | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceStockRef | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [godownMetric, setGodownMetric] = useState<GodownMetric | null>(null);
  const [lowOpen, setLowOpen] = useState(false);
  // Switching the godown returns cached data instantly (isLoading stays false),
  // so force a brief shimmer on every change for clear feedback.
  const [switching, setSwitching] = useState(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (switchTimer.current) clearTimeout(switchTimer.current); }, []);
  const changeGodown = (v: string) => {
    if (v === locationId) return;
    setLocationId(v);
    setPage(1);
    setSwitching(true);
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => setSwitching(false), 550);
  };

  const canWrite = role === "SUPER_ADMIN" || role === "MANAGER";
  const loc = locationId || undefined;

  const locQ = useQuery({ queryKey: ["stock-locations"], queryFn: () => fetchLocations(actionConfig) });
  const locations = locQ.data ?? [];
  const showActions = locQ.isLoading || locations.length > 0;

  const sumQ = useQuery({ queryKey: ["stock-summary", locationId], queryFn: () => fetchBalancesSummary(actionConfig, loc), enabled: view === "home" || view === "balances" });
  const nearQ = useQuery({ queryKey: ["stock-near-expiry", locationId], queryFn: () => fetchNearExpiry(actionConfig, { locationId: loc }), enabled: view === "home" || view === "near-expiry" });
  const homeBalQ = useQuery({ queryKey: ["stock-balances", "home", locationId], queryFn: () => fetchBalances(actionConfig, { locationId: loc, page: 1, pageSize: 6 }), enabled: view === "home" });
  const balQ = useQuery({ queryKey: ["stock-balances", locationId, search, lowOnly, page], queryFn: () => fetchBalances(actionConfig, { locationId: loc, search: search || undefined, lowOnly, page, pageSize: PAGE }), enabled: view === "balances" });
  const activity = useActivity(actionConfig, locationId, view === "home" ? 8 : 40, view === "home" || view === "activity");

  const refreshAll = () => {
    for (const k of ["stock-balances", "stock-summary", "stock-locations", "stock-grns", "stock-transfers", "stock-adjustments", "stock-near-expiry"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const nearRows = nearQ.data ?? [];
  const selectedGodown = locationId ? locations.find((l) => l.id === locationId)?.name : null;
  const scope = selectedGodown ? `in ${selectedGodown}` : `across ${locations.length} godown${plural(locations.length)}`;
  const balTotal = balQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(balTotal / PAGE));
  const goView = (v: View) => { setView(v); setPage(1); };
  const onActivityDetail = (ref: ActivityRef) => {
    if (ref.kind === "sale" || ref.kind === "reversal" || ref.kind === "return") setInvoiceDetail({ invoiceId: ref.id, kind: ref.kind });
    else setDetailDoc({ kind: ref.kind, id: ref.id });
  };

  return (
    <DashboardShell role={role} active="stock">
      <PageHeader
        title="Stock"
        subtitle="On-hand, expiry and activity across your godowns."
        action={showActions ? (
          <StockHeaderActions
            loading={locQ.isLoading} locations={locations} locationId={locationId} canWrite={canWrite}
            onGodown={changeGodown} onLookup={() => setLookupOpen(true)} onEntry={goEntry}
          />
        ) : undefined}
      />

      {locations.length === 0 && !locQ.isLoading ? (
        <EmptyGodowns canWrite={canWrite} onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          {/* Toolbar (drill-downs only): back + view-specific filters + hint. Home has no toolbar. */}
          {view !== "home" && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => goView("home")} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <ArrowLeft className="size-4" /> Stock home
              </button>
              {view === "balances" && (
                <>
                  <Input value={search} placeholder="Search a product…" onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 max-w-xs" />
                  <Button variant={lowOnly ? "default" : "outline"} onClick={() => { setLowOnly((v) => !v); setPage(1); }}>Low stock only</Button>
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {TOOLBAR_HINT[view]}
              </span>
            </div>
          )}

          {view === "home" && (
            <div className="flex flex-col gap-4">
              <KpiRow summary={sumQ.data} loading={sumQ.isLoading || switching} scope={scope} onGodown={setGodownMetric} onLow={() => setLowOpen(true)} />
              <Section warned title="Expiring soon" action={nearRows.length > 0 ? <ViewAll onClick={() => goView("near-expiry")} label={`View all ${nearRows.length}`} /> : undefined}>
                <ExpiringList rows={nearRows} loading={nearQ.isLoading || switching} limit={5} />
              </Section>
              <Section title="On hand" sub="top movers" action={<ViewAll onClick={() => goView("balances")} label="View all balances" />}>
                <HomeBalances rows={homeBalQ.data?.rows ?? []} loading={homeBalQ.isLoading || switching} canWrite={canWrite} onEditReorder={setReorderRow} onOpening={() => goEntry("opening")} onGrn={() => goEntry("in")} />
              </Section>
              <Section title="Recent activity" action={<ViewAll onClick={() => goView("activity")} label="View full history" />}>
                <HomeActivityTable items={activity.items} loading={activity.loading || switching} onDetail={onActivityDetail} limit={6} />
              </Section>
            </div>
          )}

          {view === "balances" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {balQ.error ? <p className="px-4 py-6 text-sm text-destructive">{(balQ.error as Error).message}</p> : (
                <BalancesTable rows={balQ.data?.rows ?? []} loading={balQ.isLoading || switching} canWrite={canWrite} onEditReorder={setReorderRow} filtered={Boolean(search) || lowOnly} onOpening={() => goEntry("opening")} onGrn={() => goEntry("in")} skeletonRows={PAGE} />
              )}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
                <span>{balTotal === 0 ? "No rows" : `Page ${page} of ${pageCount} · ${balTotal} row${plural(balTotal)}`}</span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}

          {view === "activity" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ActivityFeed items={activity.items} loading={activity.loading || switching} onDetail={onActivityDetail} />
            </div>
          )}

          {view === "near-expiry" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <NearExpiryTable rows={nearRows} loading={nearQ.isLoading || switching} />
            </div>
          )}
        </>
      )}

      <StockDialogs
        actionConfig={actionConfig} loc={loc}
        addOpen={addOpen} onAddClose={() => setAddOpen(false)} onAddDone={() => { setAddOpen(false); refreshAll(); }}
        reorderRow={reorderRow} onReorderClose={() => setReorderRow(null)} onReorderDone={() => { setReorderRow(null); qc.invalidateQueries({ queryKey: ["stock-balances"] }); }}
        detailDoc={detailDoc} onDetailClose={() => setDetailDoc(null)}
        lookupOpen={lookupOpen} onLookupClose={() => setLookupOpen(false)}
        godownMetric={godownMetric} onGodownClose={() => setGodownMetric(null)}
        lowOpen={lowOpen} onLowClose={() => setLowOpen(false)}
      />
      {invoiceDetail && <InvoiceStockDetailDialog actionConfig={actionConfig} refItem={invoiceDetail} onClose={() => setInvoiceDetail(null)} />}
    </DashboardShell>
  );
}

export const StockJournal = withQueryClient(StockJournalInner);
