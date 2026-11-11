"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { useTableUrlState } from "@/components/data-table/use-table-url-state";
import type { ActionConfig } from "@/lib/api-client";
import { buildInvoiceColumns } from "./invoices-columns";
import { openInvoicePdf, type InvoiceRow } from "./invoices-api";
import { downloadInvoicePdf, openInvoicePdfInNewTab } from "./invoice-pdf";

const FILTER_KEYS = ["q", "customerId"] as const;
const DEFAULT_SORT: SortingState = [{ id: "invoiceDate", desc: true }];

/** Search + customer filter (both in the URL so Back/refresh/share restore the
 *  exact view), the paged query, and the PDF opener. */
export function useInvoicesList(actionConfig: ActionConfig) {
  const url = useTableUrlState({ filterKeys: FILTER_KEYS, defaultSort: DEFAULT_SORT });
  const applied = url.filters.q;
  const customerId = url.filters.customerId;
  const [qInput, setQInput] = useState(applied);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null);
  const queryClient = useQueryClient();

  // Deep-link: /invoices?customerId=…&customerName=… ("View all" from a customer).
  const customerName = useSearchParams().get("customerName");

  const columns = buildInvoiceColumns({
    onCancel: setCancelTarget,
    // Download is on every row: generated invoices render on demand client-side;
    // legacy uploaded ones stream their stored file.
    onDownload: (row) =>
      row.invoiceSource === "generated"
        ? void downloadInvoicePdf(actionConfig, row.id).catch(() => undefined)
        : openInvoicePdf(row.id, row.invoiceNumber),
  });

  const paged = usePagedTable<InvoiceRow>({
    actionConfig,
    queryKey: "invoices",
    path: "/invoices",
    rowsKey: "invoices",
    columns,
    initialSort: DEFAULT_SORT,
    filters: { q: applied, customerId },
    sorting: url.sorting,
    onSortingChange: url.setSorting,
    pagination: url.pagination,
    onPaginationChange: url.setPagination,
  });

  return {
    qInput, setQInput, applied,
    applySearch: () => url.setFilter("q", qInput.trim()),
    clearSearch: () => { setQInput(""); url.setFilter("q", ""); },
    customerId, customerName, clearCustomer: () => url.setFilter("customerId", ""),
    createOpen, setCreateOpen,
    cancelTarget, setCancelTarget,
    // Row-click opens the PDF in a new tab. Generated invoices are rendered on
    // demand from data (client-side, no stored copy); legacy uploaded ones stream
    // their stored file.
    openPdf: (row: InvoiceRow) =>
      row.invoiceSource === "generated"
        ? void openInvoicePdfInNewTab(actionConfig, row.id).catch(() => undefined)
        : openInvoicePdf(row.id, row.invoiceNumber),
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    ...paged,
  };
}

export type InvoicesListState = ReturnType<typeof useInvoicesList>;
