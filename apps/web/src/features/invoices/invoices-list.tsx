"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { ActionConfig } from "@/lib/api-client";
import { invoiceColumns, invoiceSkeleton } from "./invoices-columns";
import { InvoiceCancelDialog } from "./invoice-cancel-dialog";
import { InvoicesSearchBar } from "./invoices-search-bar";
import { useInvoicesList } from "./use-invoices-list";

// MANAGER included since SA can grant the Invoices section to Managers (0073).
export type InvoicesRole = "SUPER_ADMIN" | "ACCOUNTANT" | "MANAGER";

function InvoicesInner({ role, actionConfig }: { readonly role: InvoicesRole; readonly actionConfig: ActionConfig }) {
  const s = useInvoicesList(actionConfig);

  return (
    <>
    <DashboardShell role={role} active="invoices">
      <PageHeader
        title="Invoices"
        subtitle={`${s.total} invoice${s.total === 1 ? "" : "s"} — click a row to open the PDF. Create one from an order (Orders → Create Invoice) or with New invoice.`}
        action={role === "SUPER_ADMIN" || role === "ACCOUNTANT" ? (
          <Link href="/invoices/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="size-4" />New invoice
          </Link>
        ) : undefined}
      />

      <InvoicesSearchBar s={s} />

      {s.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {s.error.message}
        </div>
      ) : null}

      <DataTable
        table={s.table}
        columnCount={invoiceColumns.length}
        isLoading={s.showSkeleton}
        skeleton={invoiceSkeleton}
        pageSize={s.pageSize}
        pageCount={s.pageCount}
        empty="No invoices yet."
        onRowClick={(row) => s.openPdf(row)}
      />
    </DashboardShell>
      <InvoiceCancelDialog
        target={s.cancelTarget}
        actionConfig={actionConfig}
        onOpenChange={(open) => { if (!open) s.setCancelTarget(null); }}
        onCancelled={() => { s.setCancelTarget(null); s.invalidate(); }}
      />
    </>
  );
}

export const InvoicesList = withQueryClient(InvoicesInner);
