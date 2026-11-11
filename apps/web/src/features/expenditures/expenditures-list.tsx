"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { ActionConfig } from "@/lib/api-client";
import { expenditureSkeleton } from "./expenditures-skeleton";
import { DateRangePicker } from "./expenditure-date-picker";
import { ExpenditureFilters } from "./expenditure-filters";
import { ExpenditureSummaryPanel } from "./expenditure-summary";
import { ExpenditureFormDialog } from "./expenditure-form-dialog";
import { ExpenditureCategoryDialog } from "./expenditure-category-dialog";
import { ExpenditureBillDialog } from "./expenditure-bill-dialog";
import { ExpenditureDeleteDialog } from "./expenditure-delete-dialog";
import { useExpendituresList } from "./use-expenditures-list";

function entryWord(n: number): string {
  return n === 1 ? "entry" : "entries";
}

export type ExpendituresRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

function ExpendituresInner({ role, actionConfig }: { readonly role: ExpendituresRole; readonly actionConfig: ActionConfig }) {
  const s = useExpendituresList(actionConfig);

  return (
    <>
      <DashboardShell role={role} active="expenditures">
        <PageHeader
          title="Expenditure"
          subtitle={s.isLoading ? "Loading…" : `${s.total} ${entryWord(s.total)} in this period`}
          // The period picker sits top-right, beside the title.
          action={<DateRangePicker from={s.from} to={s.to} onChange={s.setPeriod} />}
        />

        {/* Search + type + category filters on the left, the actions on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ExpenditureFilters s={s} categories={s.categories} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => s.setCategoryOpen(true)}>+ Category</Button>
            <Button onClick={s.openNew}>+ Record Expenditure</Button>
          </div>
        </div>

        <ExpenditureSummaryPanel actionConfig={actionConfig} from={s.from} to={s.to} />

        {s.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{s.error.message}</div>
        )}

        <DataTable
          table={s.table}
          columnCount={s.columns.length}
          isLoading={s.showSkeleton}
          skeleton={expenditureSkeleton}
          pageSize={s.pageSize}
          pageCount={s.pageCount}
          empty={s.hasFilters ? "No expenditures match your filters." : "No expenditures recorded in this period."}
          onRowClick={(entry) => (entry.hasBill ? s.setBillFor(entry) : s.handleEdit(entry))}
        />

        <p className="text-xs text-muted-foreground">Click a row to view its bill, or use Edit to change an entry.</p>
      </DashboardShell>

      <ExpenditureFormDialog
        open={s.formOpen}
        onOpenChange={s.setFormOpen}
        categories={s.categories}
        people={s.people}
        editing={s.editing}
        actionConfig={actionConfig}
      />
      <ExpenditureCategoryDialog open={s.categoryOpen} onOpenChange={s.setCategoryOpen} actionConfig={actionConfig} />
      <ExpenditureBillDialog
        entry={s.billFor}
        onClose={() => s.setBillFor(null)}
        actionConfig={actionConfig}
        onEdit={(entry) => { s.setBillFor(null); s.handleEdit(entry); }}
        onDelete={(entry) => { s.setBillFor(null); s.setDeleting(entry); }}
      />
      <ExpenditureDeleteDialog deleting={s.deleting} onOpenChange={() => s.setDeleting(null)} onConfirm={s.confirmDelete} />
    </>
  );
}

export const ExpendituresList = withQueryClient(ExpendituresInner);
