"use client";

import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import { litres, rupees, formatDate } from "@/lib/format";
import { formatMonthYear } from "@/components/form/month-year-field";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import {
  fetchAdjustmentDetail, fetchGrnDetail, fetchTransferDetail,
  type AdjustmentDetail, type GrnDetail, type TransferDetail,
} from "./stock-api";
import { SkRows } from "./stock-skeletons";

export type DocKind = "grn" | "transfer" | "adjustment";
export interface DocRef { kind: DocKind; id: string }

const REASON_LABEL: Record<string, string> = { damage: "Damage", count_correction: "Count correction", write_off: "Write-off", expiry: "Expiry", other: "Other" };
const TITLE: Record<DocKind, string> = { grn: "Stock-in", transfer: "Inter-godown transfer", adjustment: "Stock adjustment" };
/** Stable keys for the fixed-count meta shimmer blocks (avoids index keys). */
const DOC_META_KEYS = ["meta-a", "meta-b", "meta-c", "meta-d", "meta-e"];

function StatusPill({ status }: Readonly<{ status: string }>) {
  const ok = status === "posted";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ok ? "Posted" : "Cancelled"}</span>;
}

function Meta({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function ProductCell({ name, pack, brand }: Readonly<{ name: string; pack: number; brand: string | null }>) {
  return (
    <td className="px-3 py-2">
      <div className="font-medium text-foreground">{name}</div>
      <div className="text-xs text-muted-foreground">{litres(pack)} L{brand ? ` · ${brand}` : ""}</div>
    </td>
  );
}

function LinesShell({ head, children }: Readonly<{ head: ReactNode; children: ReactNode }>) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function GrnBody({ d }: Readonly<{ d: GrnDetail }>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Meta label="Supplier">{d.supplierName}</Meta>
        <Meta label="Godown">{d.locationName}</Meta>
        <Meta label="Status"><StatusPill status={d.status} /></Meta>
        <Meta label="Supplier invoice">{d.supplierInvoiceNo ?? "—"}</Meta>
        <Meta label="Stock-in value"><span className="font-mono">{rupees(d.totalValue)}</span></Meta>
        {d.note ? <Meta label="Note">{d.note}</Meta> : null}
      </div>
      <LinesShell head={<>
        <th className="px-3 py-2 text-left font-medium">Product</th>
        <th className="px-3 py-2 text-right font-medium">Qty</th>
        <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
        <th className="px-3 py-2 text-right font-medium">Amount ₹</th>
      </>}>
        {d.lines.map((l) => {
          const meta = [
            l.batchNumber && `Batch ${l.batchNumber}`,
            l.expiryDate && `Exp ${formatMonthYear(l.expiryDate)}`,
            [l.rackNo && `Rack ${l.rackNo}`, l.shelfNo && `Shelf ${l.shelfNo}`, l.binNo && `Bin ${l.binNo}`].filter(Boolean).join(" · "),
          ].filter(Boolean).join("     ·     ");
          return (
            <Fragment key={`${l.productName}-${l.packSizeLitres}-${l.qtyUnits}-${l.batchNumber ?? ""}`}>
              <tr className={meta ? "" : "border-b border-border/60 last:border-0"}>
                <ProductCell name={l.productName} pack={l.packSizeLitres} brand={l.brand} />
                <td className="px-3 py-2 text-right font-mono">{l.qtyUnits}</td>
                <td className="px-3 py-2 text-right font-mono">{l.rate ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{l.amount == null ? "—" : rupees(l.amount)}</td>
              </tr>
              {meta && (
                <tr className="border-b border-border/60 last:border-0">
                  <td className="px-3 pb-2 text-xs text-muted-foreground" colSpan={4}>{meta}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </LinesShell>
    </>
  );
}

function TransferBody({ d }: Readonly<{ d: TransferDetail }>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Meta label="Route">{d.fromName} → {d.toName}</Meta>
        <Meta label="Status"><StatusPill status={d.status} /></Meta>
        {d.note ? <Meta label="Note">{d.note}</Meta> : null}
      </div>
      <LinesShell head={<>
        <th className="px-3 py-2 text-left font-medium">Product</th>
        <th className="px-3 py-2 text-right font-medium">Qty moved</th>
      </>}>
        {d.lines.map((l) => (
          <tr key={`${l.productName}-${l.packSizeLitres}-${l.qtyUnits}`} className="border-b border-border/60 last:border-0">
            <ProductCell name={l.productName} pack={l.packSizeLitres} brand={l.brand} />
            <td className="px-3 py-2 text-right font-mono">{l.qtyUnits}</td>
          </tr>
        ))}
      </LinesShell>
    </>
  );
}

function AdjustmentBody({ d }: Readonly<{ d: AdjustmentDetail }>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Meta label="Godown">{d.locationName}</Meta>
        <Meta label="Reason">{REASON_LABEL[d.reason] ?? d.reason}</Meta>
        {d.note ? <Meta label="Note">{d.note}</Meta> : null}
      </div>
      <LinesShell head={<>
        <th className="px-3 py-2 text-left font-medium">Product</th>
        <th className="px-3 py-2 text-right font-medium">Change (+/−)</th>
      </>}>
        {d.lines.map((l) => (
          <tr key={`${l.productName}-${l.packSizeLitres}-${l.deltaUnits}`} className="border-b border-border/60 last:border-0">
            <ProductCell name={l.productName} pack={l.packSizeLitres} brand={l.brand} />
            <td className={`px-3 py-2 text-right font-mono font-semibold ${l.deltaUnits < 0 ? "text-red-600" : "text-green-700"}`}>{l.deltaUnits > 0 ? "+" : ""}{l.deltaUnits}</td>
          </tr>
        ))}
      </LinesShell>
    </>
  );
}

export function StockDocDetailDialog({ actionConfig, doc, onClose }: Readonly<{
  actionConfig: ActionConfig; doc: DocRef; onClose: () => void;
}>) {
  const q = useQuery<GrnDetail | TransferDetail | AdjustmentDetail>({
    queryKey: ["stock-doc", doc.kind, doc.id],
    queryFn: async () => {
      if (doc.kind === "grn") return fetchGrnDetail(actionConfig, doc.id);
      if (doc.kind === "transfer") return fetchTransferDetail(actionConfig, doc.id);
      return fetchAdjustmentDetail(actionConfig, doc.id);
    },
  });

  const d = q.data;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{d ? d.docNumber : TITLE[doc.kind]}</DialogTitle>
          <DialogDescription>{TITLE[doc.kind]}{d ? ` · ${formatDate(d.date)}` : ""}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {(() => {
            if (q.isLoading) {
              return (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {DOC_META_KEYS.map((k) => (
                      <div key={k} className="space-y-1.5"><Shimmer className="h-3 w-16" /><Shimmer className="h-4 w-28" /></div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm"><tbody>
                      <SkRows rows={3} cells={[{ w: "w-40", stack: "w-20" }, { w: "w-8", align: "right" }, { w: "w-10", align: "right" }, { w: "w-14", align: "right" }]} />
                    </tbody></table>
                  </div>
                </>
              );
            }
            if (q.error) {
              return <p className="text-sm font-medium text-destructive">{errorMessage(q.error, "Could not load this document.")}</p>;
            }
            if (doc.kind === "grn") return <GrnBody d={d as GrnDetail} />;
            if (doc.kind === "transfer") return <TransferBody d={d as TransferDetail} />;
            return <AdjustmentBody d={d as AdjustmentDetail} />;
          })()}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
