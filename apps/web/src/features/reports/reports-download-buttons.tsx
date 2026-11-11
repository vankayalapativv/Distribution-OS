"use client";

/** Excel / PDF download buttons shown on an opened report; they export the
 *  already-fetched slice for THIS report only (no extra request). */
import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReportPdf, downloadReportXlsx } from "./reports-download";
import type { ReportKey, ReportSlice } from "./reports-types";

export function ReportDownloadButtons({
  reportKey,
  title,
  slice,
}: {
  readonly reportKey: ReportKey;
  readonly title: string;
  readonly slice: ReportSlice;
}) {
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  async function run(kind: "xlsx" | "pdf") {
    setBusy(kind);
    try {
      if (kind === "xlsx") await downloadReportXlsx(reportKey, title, slice);
      else await downloadReportPdf(reportKey, title, slice);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("xlsx")}>
        {busy === "xlsx" ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-1.5 size-4" />
        )}
        Excel
      </Button>
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("pdf")}>
        {busy === "pdf" ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Download className="mr-1.5 size-4" />
        )}
        PDF
      </Button>
    </div>
  );
}
