"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { readSheetRows } from "@/lib/xlsx-io";
import { parseProductsRows, type ProductReviewRow } from "./products-import";

interface BulkResult { created: number; errors: { row: number; message: string }[] }

/** State + actions for the bulk-import dialog: parse an uploaded sheet into review
 *  rows, then POST the error-free ones and fold the server's per-row errors back in. */
export function useProductsImport(actionConfig: ActionConfig, onClose: () => void) {
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

  return { rows, fileName, parsing, busy, error, done, ready, errCount, totalPacks, onFile, confirm, close };
}
