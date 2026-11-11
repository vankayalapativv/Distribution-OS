"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { type ActionConfig } from "@/lib/api-client";
import { customerColumns, customerSkeleton } from "./customers-columns";
import { CustomerCreateDialog } from "./customers-create-dialog";
import { CustomersFilterBar } from "./customers-filter-bar";
import { useCustomersList } from "./use-customers-list";
import { type CustomersRole } from "./customers-list-logic";
import { plural } from "@/lib/format";

export type { CustomersRole } from "./customers-list-logic";

function CustomersInner({ role, actionConfig }: { readonly role: CustomersRole; readonly actionConfig: ActionConfig }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const canCreate = role === "SUPER_ADMIN" || role === "MANAGER";
  const c = useCustomersList(actionConfig);

  return (
    <>
      <DashboardShell role={role} active="customers">
        <PageHeader
          crumbs={[{ label: "Management" }, { label: "Customers" }]}
          title="Customers"
          subtitle={c.isLoading ? "Loading…" : `${c.total} customer${plural(c.total)} in your organisation`}
          action={canCreate ? <Button onClick={() => setAddOpen(true)}>+ Add Customer</Button> : undefined}
        />

        <CustomersFilterBar
          search={c.search}
          setSearch={c.setSearch}
          cities={c.cities}
          salesExecutives={c.salesExecutives}
          filterCity={c.filters.city}
          filterSalesExec={c.filters.salesExecutiveId}
          filterDues={c.filters.dues}
          setFilter={c.url.setFilter}
          onDownload={() => c.downloadPdf(c.table.getState().sorting[0])}
          downloadDisabled={c.downloading || c.isLoading || c.total === 0}
          downloading={c.downloading}
        />

        {c.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {c.error.message}
          </div>
        )}

        <DataTable
          table={c.table}
          columnCount={customerColumns.length}
          isLoading={c.showSkeleton}
          skeleton={customerSkeleton}
          pageSize={c.pageSize}
          pageCount={c.pageCount}
          empty={
            c.url.hasFilters ? (
              "No customers match your filters."
            ) : (
              <>
                No customers yet.
                {canCreate && (
                  <span className="mt-4 block">
                    <Button variant="outline" onClick={() => setAddOpen(true)}>
                      Add your first customer
                    </Button>
                  </span>
                )}
              </>
            )
          }
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
        />
      </DashboardShell>

      {canCreate && (
        <CustomerCreateDialog open={addOpen} onOpenChange={setAddOpen} actionConfig={actionConfig} />
      )}
    </>
  );
}

export const CustomersList = withQueryClient(CustomersInner);
