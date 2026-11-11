/**
 * Thin wrappers around SheetJS (`xlsx`) for the bulk-import features. The library
 * is **dynamically imported** so it loads only when the client actually downloads
 * a template or uploads a file — it never ships in the main bundle.
 */

export interface SheetSpec {
  name: string;
  /** Rows as arrays of cells (array-of-arrays), header row included. */
  rows: (string | number | null)[][];
  /** Optional per-column widths (characters). */
  colWidths?: number[];
  /** Column indexes to mark hidden (e.g. a technical key column). */
  hiddenCols?: number[];
}

/** Build a multi-sheet workbook and trigger a browser download as `.xlsx`. */
export async function downloadSheets(filename: string, sheets: SheetSpec[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.colWidths || s.hiddenCols) {
      const hidden = new Set(s.hiddenCols ?? []);
      const count = s.colWidths?.length ?? s.rows[0]?.length ?? 0;
      ws["!cols"] = Array.from({ length: count }, (_, i) => ({
        wch: s.colWidths?.[i] ?? 12,
        hidden: hidden.has(i),
      }));
    }
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Read the first worksheet of an uploaded file into row objects keyed by the
 *  header cell text; every value is coerced to a trimmed string. */
export async function readSheetRows(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return raw.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[k.trim()] = String(v ?? "").trim();
    return o;
  });
}
