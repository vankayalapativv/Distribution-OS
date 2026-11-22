"use client";

import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ActionConfig } from "@/lib/api-client";
import { ImportDropzone, ImportSteps } from "@/components/import-ui";
import { ProductsImportReview } from "./products-import-review";
import { useProductsImport } from "./use-products-import";

export function ProductsImportDialog({
  actionConfig, open, onClose, onDownloadTemplate, downloading,
}: Readonly<{
  actionConfig: ActionConfig; open: boolean; onClose: () => void;
  onDownloadTemplate?: () => void; downloading?: boolean;
}>) {
  const s = useProductsImport(actionConfig, onClose);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) s.close(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import products from Excel</DialogTitle>
          <DialogDescription>Upload the filled template. Rows are checked before anything is saved.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ImportDropzone fileName={s.fileName} parsing={s.parsing} onFile={(f) => void s.onFile(f)} />

          {!s.fileName && !s.parsing && !s.error && (
            <ImportSteps onDownload={onDownloadTemplate} downloading={downloading} fillText="Fill in your new products — one row per pack size." />
          )}

          {s.fileName && s.rows.length === 0 && !s.parsing && !s.error && !s.done && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <b>No products found in this file.</b> Add your products in the template (a Product Name is required on every row), then upload it again.
            </div>
          )}

          {s.error && <p className="text-sm font-medium text-destructive">{s.error}</p>}
          {s.done && <p className="text-sm font-medium text-green-700 dark:text-green-400">{s.done}</p>}

          {s.rows.length > 0 && (
            <ProductsImportReview rows={s.rows} readyCount={s.ready.length} errCount={s.errCount} totalPacks={s.totalPacks} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={s.close} disabled={s.busy}>Close</Button>
          <Button onClick={s.confirm} disabled={s.busy || s.ready.length === 0}>{s.busy ? "Importing…" : `Import ${s.ready.length} product${s.ready.length === 1 ? "" : "s"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
