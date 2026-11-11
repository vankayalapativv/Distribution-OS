import { apiGet, type ActionConfig } from "@/lib/api-client";
import type { Order } from "./orders-api";

/** The Orders-page filters the export should respect, plus the popover's status. */
export interface OrdersExportFilters {
  /** Fulfillment status from the download popover ("all" = every status). */
  fulfillment: string;
  search?: string;
  city?: string;
  salesExecutiveId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Page through /orders/paged applying every active filter, collecting all orders.
 *  Same sort as the table (newest ordered first). */
export async function fetchAllOrders(config: ActionConfig, f: OrdersExportFilters): Promise<Order[]> {
  const qs = new URLSearchParams({ sort: "orderDate", dir: "desc", pageSize: "100" });
  if (f.fulfillment && f.fulfillment !== "all") qs.set("fulfillment", f.fulfillment);
  if (f.search?.trim()) qs.set("search", f.search.trim());
  if (f.city) qs.set("city", f.city);
  if (f.salesExecutiveId) qs.set("salesExecutiveId", f.salesExecutiveId);
  if (f.dateFrom) qs.set("dateFrom", f.dateFrom);
  if (f.dateTo) qs.set("dateTo", f.dateTo);

  const all: Order[] = [];
  for (let page = 1; page <= 500; page++) {
    qs.set("page", String(page));
    const data = await apiGet<{ orders?: Order[]; total?: number }>(config, `/orders/paged?${qs.toString()}`);
    const rows = data.orders ?? [];
    all.push(...rows);
    if (rows.length === 0 || all.length >= Number(data.total ?? 0)) break;
  }
  return all;
}
