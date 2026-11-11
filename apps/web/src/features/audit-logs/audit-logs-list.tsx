"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/data-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { withQueryClient } from "@/components/data-table/query-provider";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { auditColumns, auditSkeleton } from "./audit-logs-columns";
import { AuditLogsFilters } from "./audit-logs-filters";
import { AUDIT_SORT, useAuditFilters } from "./use-audit-filters";
import type { AuditFilterOptions, AuditLog } from "./audit-logs-api";
import { plural } from "@/lib/format";

function AuditLogsInner({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const f = useAuditFilters();

  // Distinct actors / entity types / actions present in the log.
  const filtersQ = useQuery({
    queryKey: ["audit-logs", "filters"],
    queryFn: () => apiGet<AuditFilterOptions>(actionConfig, "/audit-logs/filters"),
  });

  const { table, total, pageCount, pageSize, isLoading, showSkeleton, error } = usePagedTable<AuditLog>({
    actionConfig,
    queryKey: "audit-logs",
    path: "/audit-logs/paged",
    rowsKey: "auditLogs",
    columns: auditColumns,
    initialSort: AUDIT_SORT,
    filters: f.serverFilters,
    sorting: f.sorting,
    onSortingChange: f.setSorting,
    pagination: f.pagination,
    onPaginationChange: f.setPagination,
  });

  return (
    <DashboardShell role="SUPER_ADMIN" active="audit-logs">
      <PageHeader title="Audit Logs" subtitle={isLoading ? "Loading…" : `${total} event${plural(total)}`} />

      <AuditLogsFilters f={f} opts={filtersQ.data} isLoading={isLoading} total={total} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error.message}</div>
      )}

      <DataTable
        table={table}
        columnCount={auditColumns.length}
        isLoading={showSkeleton}
        skeleton={auditSkeleton}
        pageSize={pageSize}
        pageCount={pageCount}
        empty={f.hasFilters ? "No audit events match your filters." : "No audit events recorded yet."}
      />
    </DashboardShell>
  );
}

export const AuditLogsList = withQueryClient(AuditLogsInner);
