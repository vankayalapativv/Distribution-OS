"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { DataTable } from "@/components/data-table/data-table";
import { usePagedTable } from "@/components/data-table/use-paged-table";
import { PageHeader } from "@/components/page-header";
import type { ActionConfig } from "@/lib/api-client";
import { LogisticsToolbar } from "./logistics-toolbar";
import { LogisticsRunsSummary } from "./logistics-runs-summary";
import { VIEW_CONFIG, type LogisticsRow, type View } from "./logistics-views";

export interface Applied {
  q: string;
  from: string;
  to: string;
}

/**
 * The deliveries table for one view. Remounted (via `key={view}`) when the view
 * switches so sort + page reset to that view's defaults, running `usePagedTable`
 * against the matching endpoint + columns. Filter state lives in the parent.
 */
export function LogisticsTable({
  view, setView, qInput, setQInput, dateRange, setDateRange, applied, setApplied, actionConfig, onRowClick,
}: {
  readonly view: View;
  readonly setView: (view: View) => void;
  readonly qInput: string;
  readonly setQInput: (q: string) => void;
  readonly dateRange: DateRange | undefined;
  readonly setDateRange: (range: DateRange | undefined) => void;
  readonly applied: Applied;
  readonly setApplied: (applied: Applied) => void;
  readonly actionConfig: ActionConfig;
  readonly onRowClick: (row: LogisticsRow) => void;
}) {
  const cfg = VIEW_CONFIG[view];
  const queryClient = useQueryClient();

  const { table, total, pageCount, pageSize, showSkeleton, isFetching, error } = usePagedTable<LogisticsRow>({
    actionConfig,
    queryKey: cfg.rowsKey,
    path: cfg.path,
    rowsKey: cfg.rowsKey,
    columns: cfg.columns,
    initialSort: cfg.initialSort,
    filters: { q: applied.q, from: applied.from, to: applied.to },
  });

  // Search-as-you-type (350ms, matching the Customers page): the query + date
  // range settle into `applied` after typing/selection stops — no Search button.
  useEffect(() => {
    const from = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
    const to = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";
    const q = qInput.trim();
    if (q === applied.q && from === applied.from && to === applied.to) return;
    const t = setTimeout(() => setApplied({ q, from, to }), 350);
    return () => clearTimeout(t);
  }, [qInput, dateRange, applied, setApplied]);

  const clear = () => {
    setQInput("");
    setDateRange(undefined);
    setApplied({ q: "", from: "", to: "" });
  };

  return (
    <>
      <PageHeader
        title="Logistics — Delivery Runs"
        subtitle="Each driver's daily run: start & end times, distance, stops, and proof photos."
      />
      {view === "runs" && <LogisticsRunsSummary actionConfig={actionConfig} />}
      <LogisticsToolbar
        view={view} setView={setView} qInput={qInput} setQInput={setQInput}
        dateRange={dateRange} setDateRange={setDateRange} onClear={clear}
        onRefresh={() => void queryClient.refetchQueries({ queryKey: [cfg.rowsKey] })}
        isFetching={isFetching} isLoading={showSkeleton} total={total}
      />
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error.message}</div>}
      <DataTable
        table={table}
        columnCount={cfg.columnCount}
        isLoading={showSkeleton}
        skeleton={cfg.skeleton}
        pageSize={pageSize}
        pageCount={pageCount}
        empty="No records found for this search."
        onRowClick={onRowClick}
      />
    </>
  );
}
