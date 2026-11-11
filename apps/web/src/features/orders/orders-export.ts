import type { RowInput } from "jspdf-autotable";
import { downloadTablePdf } from "@/lib/pdf-doc";
import type { ActionConfig } from "@/lib/api-client";
import { fetchCompanyProfile } from "@/lib/company";
import { HEAD, FULFILLMENT_LABELS, buildRows } from "./orders-export-rows";
import { fetchAllOrders, type OrdersExportFilters } from "./orders-export-fetch";

/**
 * Orders export — download orders as a PDF or an Excel workbook, ONE ROW PER
 * ORDER, with all of an order's SKUs comma-joined in the Products cell. The
 * download honours the page's current filters plus the fulfillment status picked
 * in the popover. Heavy libs (jspdf / xlsx) are imported at call time.
 */
export type { OrdersExportFilters } from "./orders-export-fetch";
export { buildRows } from "./orders-export-rows";

/** Fulfillment options for the download picker ("all" = every status). */
export const ORDER_EXPORT_STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "partially_delivered", label: "Partially delivered" },
  { value: "delivered", label: "Delivered" },
  { value: "partially_returned", label: "Partially returned" },
  { value: "returned", label: "Returned" },
  { value: "partially_cancelled", label: "Partially cancelled" },
  { value: "cancelled", label: "Cancelled" },
];

function statusLabel(fulfillment: string): string {
  return fulfillment && fulfillment !== "all" ? (FULFILLMENT_LABELS[fulfillment] ?? fulfillment) : "All statuses";
}

function generatedOn(): string {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export async function downloadOrdersPdf(config: ActionConfig, filters: OrdersExportFilters): Promise<void> {
  const orders = await fetchAllOrders(config, filters);
  const body: RowInput[] = buildRows(orders).map((r, i) => [String(i + 1), ...r]);
  const company = await fetchCompanyProfile(config);
  await downloadTablePdf({
    company,
    fileName: `Orders - ${statusLabel(filters.fulfillment)}.pdf`,
    title: "Orders",
    metaLine: `${statusLabel(filters.fulfillment)} · ${orders.length} order${orders.length !== 1 ? "s" : ""} · Generated ${generatedOn()}`,
    head: ["#", ...HEAD],
    body,
    columnStyles: { 0: { cellWidth: 24, halign: "right" }, 10: { halign: "right" } },
    zebra: true,
  });
}

export async function downloadOrdersExcel(config: ActionConfig, filters: OrdersExportFilters): Promise<void> {
  const orders = await fetchAllOrders(config, filters);
  const aoa: (string | number)[][] = [HEAD, ...buildRows(orders)];
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Orders");
  XLSX.writeFile(wb, `Orders - ${statusLabel(filters.fulfillment)}.xlsx`);
}
