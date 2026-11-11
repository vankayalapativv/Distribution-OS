import type { RowInput } from "jspdf-autotable";
import { footLabelCell, type TablePdfOptions } from "@/lib/pdf-doc";
import type { LedgerData } from "./customer-ledger-tab";

export const amt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Signed balance as "1,234.00 Dr" / "500.00 Cr" / "0.00". */
export const bal = (n: number): string => {
  if (Math.abs(n) < 0.005) return "0.00";
  return `${amt(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;
};

/** ISO YYYY-MM-DD → DD-MM-YYYY. */
export const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
};

/** Today as DD/MM/YYYY (IST) for the "Generated on" line. */
export function todayIst(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date());
}

const SHADE = { fillColor: [240, 240, 240] as [number, number, number], fontStyle: "bold" as const };
const HEAD: RowInput = ["Date", "Type", "Vch No.", "Particulars", "Narration", "Debit (Rs.)", "Credit (Rs.)", "Balance (Rs.)"];

/** Build the full ledger-statement PDF options (pure) — letterhead table for the
 *  customer's transactions with opening balance, per-row Dr/Cr, and totals. */
export function buildLedgerOptions(
  customerName: string,
  data: LedgerData,
): Omit<TablePdfOptions, "company"> {
  const body: RowInput[] = [
    [
      { content: `Opening Balance (before ${fmtDate(data.from)})`, colSpan: 7, styles: SHADE },
      { content: bal(data.openingBalance), styles: { ...SHADE, halign: "right" } },
    ],
  ];
  if (data.rows.length === 0) {
    body.push([{ content: "No transactions in this period.", colSpan: 8, styles: { halign: "center", textColor: [110, 110, 110] } }]);
  } else {
    for (const r of data.rows) {
      body.push([
        fmtDate(r.date), r.type, r.vchNo ?? "", r.particulars, r.narration,
        r.debit != null ? amt(r.debit) : "", r.credit != null ? amt(r.credit) : "", bal(r.balance),
      ]);
    }
  }

  const grandDebit = Math.max(0, data.openingBalance) + data.totals.debit + Math.max(0, -data.totals.closingBalance);
  const grandCredit = Math.max(0, -data.openingBalance) + data.totals.credit + Math.max(0, data.totals.closingBalance);

  const foot: RowInput[] = [
    [footLabelCell("Total", 5), amt(data.totals.debit), amt(data.totals.credit), ""],
    [footLabelCell(`${data.totals.closingBalance >= 0 ? "Debit" : "Credit"} Balance`, 5), "", "", bal(data.totals.closingBalance)],
    [footLabelCell("Grand Total", 5), amt(grandDebit), amt(grandCredit), ""],
  ];

  return {
    fileName: `Ledger - ${customerName.replace(/[\\/:*?"<>|]/g, "-")}.pdf`,
    title: "Ledger",
    metaLine: `( From ${fmtDate(data.from)} to ${fmtDate(data.to)} )  ·  Account: ${customerName}  ·  Generated on ${todayIst()}`,
    head: HEAD,
    body,
    foot,
    columnStyles: {
      0: { cellWidth: 58 }, 1: { cellWidth: 42 }, 2: { cellWidth: 74 }, 3: { cellWidth: 90 },
      5: { halign: "right", cellWidth: 78 }, 6: { halign: "right", cellWidth: 78 }, 7: { halign: "right", cellWidth: 82 },
    },
    // Keep only "Total" and "Grand Total" ruled; the middle balance row sits inline.
    didParseCell: (d) => {
      if (d.section === "foot" && d.row.index === 1) d.cell.styles.lineWidth = { top: 0 };
    },
  };
}
