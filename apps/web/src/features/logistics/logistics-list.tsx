"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { withQueryClient } from "@/components/data-table/query-provider";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { useUrlState } from "@/lib/use-url-state";
import type { ActionConfig } from "@/lib/api-client";
import { LogisticsTable, type Applied } from "./logistics-table";
import { LogisticsDetailModal } from "./logistics-detail-modal";
import { LogisticsRunDrawer } from "./logistics-run-drawer";
import type { LogisticsRow, View } from "./logistics-views";

export type LogisticsRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

interface LogisticsListProps {
  readonly role: LogisticsRole;
  readonly actionConfig: ActionConfig;
}

const VIEWS: readonly View[] = ["runs", "customers", "deliveries"];
const parseDay = (s: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

/**
 * The view tab + the applied search/date filters live in the URL with `replace`
 * (Back/refresh restore them); the run drawer (`?run=`) and the customer modal
 * (`?customer=`) live in the URL with `push`, so opening one is a history entry
 * the browser Back button closes. The search box text + the open calendar range
 * stay local (transient UI until "applied").
 */
function LogisticsInner({ role, actionConfig }: LogisticsListProps) {
  const { get, set } = useUrlState();
  const rawView = get("view");
  const view: View = (VIEWS as readonly string[]).includes(rawView) ? (rawView as View) : "runs";
  const applied: Applied = { q: get("q"), from: get("from"), to: get("to") };
  const [qInput, setQInput] = useState(applied.q);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    applied.from ? { from: parseDay(applied.from), to: parseDay(applied.to) } : undefined,
  );
  const runId = get("run") || null;
  const customerId = get("customer") || null;

  const setView = (v: View) => set({ view: v === "runs" ? null : v, run: null, customer: null });
  const setApplied = (a: Applied) => set({ q: a.q || null, from: a.from || null, to: a.to || null });
  const setRunId = (id: string | null) => set({ run: id }, id ? "push" : "replace");
  const setCustomerId = (id: string | null) => set({ customer: id }, id ? "push" : "replace");

  // Runs open the run drawer (by runId); customer/delivery rows open the customer modal.
  const onRowClick = (row: LogisticsRow) => {
    if ("runId" in row && view === "runs") setRunId(row.runId);
    else if ("customerId" in row) setCustomerId(row.customerId);
  };

  return (
    <>
      <DashboardShell role={role} active="logistics">
        <LogisticsTable
          key={view}
          view={view}
          setView={setView}
          qInput={qInput}
          setQInput={setQInput}
          dateRange={dateRange}
          setDateRange={setDateRange}
          applied={applied}
          setApplied={setApplied}
          actionConfig={actionConfig}
          onRowClick={onRowClick}
        />
      </DashboardShell>

      <LogisticsRunDrawer actionConfig={actionConfig} openId={runId} onClose={() => setRunId(null)} />
      <LogisticsDetailModal
        actionConfig={actionConfig}
        openId={customerId}
        from={applied.from}
        to={applied.to}
        onClose={() => setCustomerId(null)}
      />
    </>
  );
}

export const LogisticsList = withQueryClient(LogisticsInner);
