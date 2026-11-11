"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { readSheetRows } from "@/lib/xlsx-io";
import { ImportDropzone, ImportStatusBadge, ImportSteps, ImportSummary, ImportTotals, ReviewTable } from "@/components/import-ui";
import { parseProductsRows, type ProductReviewRow } from "./products-import";

interface BulkResult { created: number; errors: { row: number; message: string }[] }

export function ProductsImportDialog({
  actionConfig, open, onClose, onDownloadTemplate, downloading,
}: Readonly<{
  actionConfig: ActionConfig; open: boolean; onClose: () => void;
  onDownloadTemplate?: () => void; downloading?: boolean;
}>) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ProductReviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => { setRows([]); setFileName(""); setError(null); setDone(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setError(null); setDone(null); setFileName(file.name); setParsing(true);
    try {
      setRows(parseProductsRows(await readSheetRows(file)));
    } catch (e) {
      setRows([]); setError(errorMessage(e, "Could not read that file. Is it a valid .xlsx?"));
    } finally {
      setParsing(false);
    }
  };

  const ready = rows.filter((r) => !r.error);
  const confirm = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await apiRequest<BulkResult>(actionConfig, "POST", "/products/bulk", { products: ready.map((r) => r.product) });
      const byRow = new Map(res.errors.map((e) => [e.row, e.message]));
      ready.forEach((r, i) => { r.serverError = byRow.get(i + 1) ?? null; });
      setRows([...rows]);
      setDone(`Imported ${res.created} product${res.created === 1 ? "" : "s"}.${res.errors.length ? ` ${res.errors.length} row${res.errors.length === 1 ? "" : "s"} skipped.` : ""}`);
      if (res.created > 0) {
        void qc.invalidateQueries({ queryKey: ["products"] });
        void qc.invalidateQueries({ queryKey: ["brands", "oils"] });
      }
    } catch (e) {
      setError(errorMessage(e, "Import failed. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const errCount = rows.length - ready.length;
  const totalPacks = ready.reduce((s, r) => s + (r.product.unit === "litres" ? r.product.packs.length : 0), 0);
  const productCols = [
    { label: "Product" }, { label: "Brand" }, { label: "Segments" },
    { label: "Pack sizes" }, { label: "Status" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import products from Excel</DialogTitle>
          <DialogDescription>Upload the filled template. Rows are checked before anything is saved.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ImportDropzone fileName={fileName} parsing={parsing} onFile={(f) => void onFile(f)} />

          {!fileName && !parsing && !error && (
            <ImportSteps onDownload={onDownloadTemplate} downloading={downloading} fillText="Fill in your new products — one row per pack size." />
          )}

          {fileName && rows.length === 0 && !parsing && !error && !done && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <b>No products found in this file.</b> Add your products in the template (a Product Name is required on every row), then upload it again.
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {done && <p className="text-sm font-medium text-green-700 dark:text-green-400">{done}</p>}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ImportSummary ready={ready.length} errors={errCount} total={rows.length} />
                <ImportTotals items={[{ value: totalPacks.toLocaleString("en-IN"), label: "packs" }]} />
              </div>
              <ReviewTable columns={productCols}>
                {rows.map((r, i) => {
                  const msg = r.error ?? r.serverError;
                  return (
                    <tr key={`${r.product.productName}-${r.product.brand}-${i}`} className={`border-b border-border/60 last:border-0 ${msg ? "bg-red-50/60 dark:bg-red-950/20" : i % 2 ? "bg-muted/20" : ""}`}>
                      <td className="px-3 py-2 text-center align-middle">
                        <div className="whitespace-nowrap font-semibold text-foreground">{r.product.productName}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">{r.product.unit} · HSN {r.product.hsnCode || "—"}</div>
                        {msg && <div className="text-[11.5px] text-destructive">{msg}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center align-middle font-medium text-primary">{r.product.brand || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs text-muted-foreground">{r.product.segments.join(", ") || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-xs">
                        {r.product.unit === "quantity" ? (
                          <span className="text-muted-foreground">piece (sold each)</span>
                        ) : r.product.packs.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {r.product.packs.map((p) => `${p.packSize}L`).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle"><ImportStatusBadge ok={!msg}>{msg ? "Error" : r.serverError === null ? "Imported" : "Ready"}</ImportStatusBadge></td>
                    </tr>
                  );
                })}
              </ReviewTable>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Close</Button>
          <Button onClick={confirm} disabled={busy || ready.length === 0}>{busy ? "Importing…" : `Import ${ready.length} product${ready.length === 1 ? "" : "s"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
