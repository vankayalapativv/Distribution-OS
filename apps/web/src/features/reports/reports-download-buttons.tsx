"use client";

/** Single ⋮ kebab on an opened report → a dropdown with Excel + PDF downloads of
 *  THIS report's already-fetched slice (no extra request). Replaces the two
 *  inline buttons with the house row-actions pattern (one ⋮ popover, not inline
 *  buttons). Shown on every report via `reports-view`. */
import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { downloadReportPdf, downloadReportXlsx } from "./reports-download";
import type { ReportKey, ReportSlice } from "./reports-types";

export function ReportDownloadButtons({
  reportKey,
  title,
  slice,
  legalName,
}: {
  readonly reportKey: ReportKey;
  readonly title: string;
  readonly slice: ReportSlice;
  /** The tenant's enterprise legal name — leads the download filename. */
  readonly legalName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  async function run(kind: "xlsx" | "pdf") {
    setOpen(false);
    setBusy(kind);
    try {
      if (kind === "xlsx") await downloadReportXlsx(reportKey, title, slice, legalName);
      else await downloadReportPdf(reportKey, title, slice, legalName);
    } finally {
      setBusy(null);
    }
  }

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Download"
        aria-label="Download report"
        disabled={busy !== null}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-40 gap-0.5 p-1.5">
        <button type="button" className={itemClass} onClick={() => void run("xlsx")}>
          <FileSpreadsheet className="size-4" />
          Excel
        </button>
        <button type="button" className={itemClass} onClick={() => void run("pdf")}>
          <Download className="size-4" />
          PDF
        </button>
      </PopoverContent>
    </Popover>
  );
}
