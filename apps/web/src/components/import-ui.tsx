"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

/** Shared UI for the Excel bulk-import dialogs (Products + Stock) so the three
 *  dialogs look and behave identically: a drop/click zone, a summary chip row,
 *  totals, status badges, a sticky-header review table, and the 1·2·3 helper. */

export function ImportDropzone({
  fileName, parsing, onFile, accept = ".xlsx,.xls",
}: Readonly<{ fileName: string; parsing: boolean; onFile: (file: File) => void; accept?: string }>) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const open = () => ref.current?.click();
  const pick = (f: File | undefined) => { if (f) onFile(f); };
  const input = <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />;

  // Once a file is chosen, collapse to a compact chip so the review table gets
  // the room — a big dropzone is only needed before a file is picked.
  if (fileName && !parsing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
        {input}
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="size-4" /></span>
          <span className="truncate text-sm font-medium text-foreground">{fileName}</span>
        </span>
        <button type="button" onClick={open} className="shrink-0 text-xs font-semibold text-primary hover:underline">Choose another</button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose or drop an Excel file"
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
        drag ? "border-primary bg-primary/5" : "border-input bg-muted/40 hover:bg-muted/60"
      }`}
    >
      {input}
      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
        {parsing ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
      </span>
      {parsing ? (
        <><b className="text-sm">Reading {fileName || "your file"}…</b><span className="text-xs text-muted-foreground">Checking rows against the catalogue…</span></>
      ) : (
        <><b className="text-sm">Drag your filled template here, or click to choose</b><span className="text-xs text-muted-foreground">Excel files only · .xlsx</span></>
      )}
    </div>
  );
}

/** A right-aligned strip of at-a-glance totals (value + label pairs). */
export function ImportTotals({ items }: Readonly<{ items: { label: string; value: string }[] }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label}><span className="font-semibold tabular-nums text-foreground">{it.value}</span> {it.label}</span>
      ))}
    </div>
  );
}

/** Bordered, scroll-capped review table with a sticky header. The dialog passes
 *  the column defs and the <tr> rows as children. */
export function ReviewTable({ columns, children }: Readonly<{ columns: { label: string; align?: "right"; width?: string }[]; children: ReactNode }>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="max-h-[46vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => (
                <th key={c.label} style={c.width ? { width: c.width } : undefined} className="whitespace-nowrap px-3 py-2 text-center align-middle font-semibold">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ tone, children }: Readonly<{ tone: "good" | "bad" | "neutral"; children: ReactNode }>) {
  const map = {
    good: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900",
    bad: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
    neutral: "bg-muted/60 text-muted-foreground border-border",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>
      {tone !== "neutral" && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function ImportSummary({ ready, errors, total }: Readonly<{ ready: number; errors: number; total: number }>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip tone="good">{ready} ready</Chip>
      {errors > 0 && <Chip tone="bad">{errors} error{errors === 1 ? "" : "s"}</Chip>}
      <Chip tone="neutral">{total} total</Chip>
    </div>
  );
}

export function ImportStatusBadge({ ok, children }: Readonly<{ ok: boolean; children: ReactNode }>) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${
      ok
        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900"
        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"
    }`}>
      {ok ? "✓" : "✕"} {children}
    </span>
  );
}

/** The empty-state 1·2·3 helper with a Download-template link in step 1. */
export function ImportSteps({
  onDownload, downloading, fillText,
}: Readonly<{ onDownload?: () => void; downloading?: boolean; fillText: string }>) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <Step n={1}>
        Download the template
        {onDownload && (
          <button type="button" onClick={onDownload} disabled={downloading} className="mt-1.5 block text-xs font-semibold text-primary hover:underline disabled:opacity-50">
            {downloading ? "Preparing…" : "↓ Download template"}
          </button>
        )}
      </Step>
      <Step n={2}>{fillText}</Step>
      <Step n={3}>Upload it here and review before saving.</Step>
    </div>
  );
}

function Step({ n, children }: Readonly<{ n: number; children: ReactNode }>) {
  return (
    <div className="min-w-[130px] flex-1 rounded-xl border border-border bg-muted/40 p-3">
      <span className="mb-1.5 grid size-[18px] place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{n}</span>
      <p className="text-xs text-foreground/90">{children}</p>
    </div>
  );
}
