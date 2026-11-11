"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { readSheetRows } from "@/lib/xlsx-io";
import { formatMonthYear } from "@/components/form/month-year-field";
import { ImportDropzone, ImportStatusBadge, ImportSteps, ImportSummary, ImportTotals, ReviewTable } from "@/components/import-ui";
import { fetchSkus, packLabel } from "./stock-api";
import {
  parseStockRows, type ImportedStockLine, type StockImportMode, type StockReviewRow,
} from "./stock-import";

export function StockImportDialog({
  actionConfig, mode, brand, open, onClose, onLoad, onDownloadTemplate, downloading,
}: Readonly<{
  actionConfig: ActionConfig;
  mode: StockImportMode;
  brand: string | null;
  open: boolean;
  onClose: () => void;
  onLoad: (lines: ImportedStockLine[]) => void;
  onDownloadTemplate?: () => void;
  downloading?: boolean;
}>) {
  const [rows, setRows] = useState<StockReviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: skus = [] } = useQuery({ queryKey: ["stock-skus-all"], queryFn: () => fetchSkus(actionConfig, ""), staleTime: 60_000 });

  const reset = () => { setRows([]); setFileName(""); setError(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setError(null); setFileName(file.name); setParsing(true);
    try {
      setRows(parseStockRows(mode, await readSheetRows(file), skus, brand));
    } catch (e) {
      setRows([]); setError(errorMessage(e, "Could not read that file. Is it a valid .xlsx?"));
    } finally {
      setParsing(false);
    }
  };

  const ready = rows.filter((r) => !r.error);
  const load = () => { onLoad(ready.map((r) => r.line)); close(); };
  const isIn = mode === "stock_in";
  const units = ready.reduce((s, r) => s + (Number(r.line.qty) || 0), 0);
  const value = ready.reduce((s, r) => s + (Number(r.line.qty) || 0) * (Number(r.line.rate) || 0), 0);
  const totals = value > 0
    ? [{ value: units.toLocaleString("en-IN"), label: "units" }, { value: value.toLocaleString("en-IN"), label: "value" }]
    : [{ value: units.toLocaleString("en-IN"), label: "units" }];
  const loc = (r: StockReviewRow) => [r.line.rack, r.line.shelf, r.line.bin].filter(Boolean).join(" · ") || "—";
  // All columns centered (header + cells); content stays one line. Rate is required
  // in both modes (a blank-rate row is rejected by validate()).
  const cols = [{ label: "Product" }, { label: "Qty" }, { label: "Rate" }, { label: "Batch · Expiry" }, { label: "Rack · Shelf · Bin" }, { label: "Status" }];
  const fillText = isIn
    ? "Type the Qty and Rate next to each product you received."
    : "Type the opening Qty and Rate next to each product you hold.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isIn ? "Import stock-in from Excel" : "Import opening stock from Excel"}</DialogTitle>
          <DialogDescription>
            Upload the filled template. Valid rows load into the grid — you review totals and Post as usual.
            {isIn && brand ? ` Scoped to ${brand}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ImportDropzone fileName={fileName} parsing={parsing} onFile={(f) => void onFile(f)} />

          {!fileName && !parsing && !error && (
            <ImportSteps onDownload={onDownloadTemplate} downloading={downloading} fillText={fillText} />
          )}

          {fileName && rows.length === 0 && !parsing && !error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <b>No quantities found in this file.</b> Type a <b>Qty</b> and <b>Rate</b> next to the products you have — rows left blank are ignored — then upload it again.
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ImportSummary ready={ready.length} errors={rows.length - ready.length} total={rows.length} />
                <ImportTotals items={totals} />
              </div>
              <ReviewTable columns={cols}>
                {rows.map((r, i) => (
                  <tr key={`${r.line.productId}-${r.line.packSizeLitres}-${i}`} className={`border-b border-border/60 last:border-0 ${r.error ? "bg-red-50/60 dark:bg-red-950/20" : i % 2 ? "bg-muted/20" : ""}`}>
                    <td className="px-3 py-2 text-center align-middle">
                      <div className="whitespace-nowrap font-semibold text-foreground">{r.line.productName || "—"}</div>
                      <div className="whitespace-nowrap text-xs font-medium">
                        <span className="text-amber-600 dark:text-amber-400">{packLabel(r.line.packSizeLitres, r.line.unit)}</span>
                        {r.line.brand && <><span className="text-muted-foreground"> · </span><span className="text-primary">{r.line.brand}</span></>}
                      </div>
                      {r.error && <div className="text-[11.5px] text-destructive">{r.error}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center align-middle font-mono tabular-nums">{r.line.qty || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center align-middle font-mono tabular-nums">{r.line.rate || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs text-muted-foreground">{[r.line.batch, formatMonthYear(r.line.expiry)].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs text-muted-foreground">{loc(r)}</td>
                    <td className="px-3 py-2 text-center align-middle"><ImportStatusBadge ok={!r.error}>{r.error ? "Error" : "Ready"}</ImportStatusBadge></td>
                  </tr>
                ))}
              </ReviewTable>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={load} disabled={ready.length === 0}>Load {ready.length} row{ready.length === 1 ? "" : "s"} into grid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
