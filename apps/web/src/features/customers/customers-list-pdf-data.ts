import type { RowInput } from "jspdf-autotable";
import { footLabelCell, type TablePdfOptions } from "@/lib/pdf-doc";
import type { Customer } from "./customers-api";

const TYPE_LABELS: Record<string, string> = {
  mechanic: "Mechanic", retail: "Retail", lof: "LOF", industrial: "Industrial",
};

export const amt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dr (owes) / Cr (credit) tag for a non-zero signed balance. */
const drCr = (n: number): string => (n > 0 ? "Dr" : "Cr");

/** Signed dues total → "X Dr" (owes) / "X Cr" (credit) / "0" (settled). */
export const dues = (n: number): string => {
  if (Math.abs(n) < 0.005) return "0";
  return `${amt(Math.abs(n))} ${drCr(n)}`;
};

/** One customer's dues cell: settled "0" only when there's business, else "—". */
export const rowDues = (n: number, hasBusiness: boolean | undefined): string => {
  if (Math.abs(n) < 0.005) return hasBusiness === false ? "—" : "0";
  return `${amt(Math.abs(n))} ${drCr(n)}`;
};

export const oldest = (d: number | null): string => {
  if (d == null) return "—";
  return `${d} day${d === 1 ? "" : "s"}`;
};

/** Today as DD/MM/YYYY (IST). */
export function todayIst(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date());
}

const HEAD: RowInput = [
  "#", "Code", "Name", "City", "Sales Executive", "Type", "Segment", "Oldest unpaid", "Collection Dues (Rs.)", "Status",
];

/** Build the "Customer List" PDF options (pure). `filterCaption` describes the
 *  active filters (empty = all). */
export function buildCustomersOptions(
  rows: Customer[],
  filterCaption: string,
): Omit<TablePdfOptions, "company"> {
  const body: RowInput[] = rows.map((c, i) => [
    String(i + 1),
    c.customerCode ?? "",
    c.legalName ?? "",
    c.addressCity ?? "—",
    c.salesExecutiveName ?? "—",
    TYPE_LABELS[c.customerType] ?? c.customerType ?? "—",
    c.segment ?? "—",
    oldest(c.oldestUnpaidDays),
    rowDues(c.collectionDues ?? 0, c.hasBusiness),
    c.status ?? "",
  ]);

  const totalDues = rows.reduce((s, c) => s + (c.collectionDues ?? 0), 0);
  const foot: RowInput[] = [
    [footLabelCell("Total collection dues", 8), { content: dues(totalDues), styles: { halign: "right" } }, ""],
  ];

  return {
    fileName: "Customer List.pdf",
    title: "Customer List",
    metaLine: `${rows.length} customer${rows.length === 1 ? "" : "s"}  ·  ${filterCaption}  ·  Generated on ${todayIst()}`,
    head: HEAD,
    body,
    foot,
    zebra: true,
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { font: "courier", textColor: [90, 90, 90], cellWidth: 54 },
      3: { cellWidth: 66 }, 4: { cellWidth: 88 }, 5: { cellWidth: 54 }, 6: { cellWidth: 64 },
      7: { halign: "right", cellWidth: 66 }, 8: { halign: "right", cellWidth: 96 }, 9: { cellWidth: 52 },
    },
  };
}
