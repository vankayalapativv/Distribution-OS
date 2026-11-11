"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import { downloadCaExport, fetchInvoiceExport } from "@/features/invoices/invoice-ca-export";
import type { ReportRange } from "./reports-api";
import { Section } from "./reports-skeletons";

/** The "Tax Export" report detail: opened like any other report card, it
 *  uses the page's shared date range and shows a period summary table with a
 *  one-click GSTR-1-ready .xlsx download (B2B, B2CS, HSN, documents issued). */
export function ReportsCaExportDetail({
  actionConfig, range, onBack,
}: Readonly<{ actionConfig: ActionConfig; range: ReportRange; onBack: () => void }>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["invoice-export", range.from, range.to],
    queryFn: () => fetchInvoiceExport(actionConfig, range.from, range.to),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to,
  });

  const download = async () => {
    if (!data) return;
    setBusy(true); setError(null);
    try { await downloadCaExport(data); }
    catch (e) { setError(errorMessage(e, "Could not build the export.")); }
    finally { setBusy(false); }
  };

  const val = (v: string | number) => {
    if (isFetching) return "…";
    return data ? String(v) : "—";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ChevronLeft className="mr-1 size-4" /> All reports
        </Button>
        <Button size="sm" onClick={download} disabled={busy || !data || data.totals.invoices === 0}>
          <Download className="mr-1 size-4" />{busy ? "Building…" : "Download .xlsx"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A GSTR-1-ready workbook of generated invoices — B2B, B2CS, HSN summary and documents issued. Uses the date range above.
      </p>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Section heading="Tax Export">
        <table className="w-full text-sm">
          <tbody>
            <Row label="B2B invoices (with GSTIN)" value={data ? val(data.b2b.length) : val(0)} />
            <Row label="B2C / counter invoices" value={data ? val(data.b2cs.reduce((s, r) => s + r.invoices, 0)) : val(0)} />
            <Row label="HSN rows" value={data ? val(data.hsn.length) : val(0)} />
            <Row label="Cancelled in period" value={data ? val(data.docs.cancelled) : val(0)} />
            <Row label="Taxable value" value={data ? val(rupees(data.totals.taxable)) : val(0)} strong />
            <Row label="Total tax" value={data ? val(rupees(data.totals.tax)) : val(0)} strong />
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Row({ label, value, strong }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-2.5 text-muted-foreground">{label}</td>
      <td className={`px-5 py-2.5 text-right font-mono ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{value}</td>
    </tr>
  );
}
