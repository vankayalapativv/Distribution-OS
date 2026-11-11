"use client";

import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { ActionConfig } from "@/lib/api-client";
import type { Alert } from "./alerts-api";
import { AlertCard } from "./alert-card";
import { AlertsStatusFilter } from "./alerts-status-filter";
import { AlertsEmpty } from "./alerts-empty";
import { useAlerts } from "./use-alerts";

export type AlertsRole = "SUPER_ADMIN" | "MANAGER";

interface AlertsListProps {
  readonly alerts: Alert[];
  readonly role: AlertsRole;
  readonly actionConfig: ActionConfig;
}

export function AlertsList({ alerts: initialAlerts, role, actionConfig }: AlertsListProps) {
  const a = useAlerts(initialAlerts, actionConfig);

  return (
    <DashboardShell role={role} active="alerts">
      <PageHeader
        title="Alerts"
        subtitle={
          <>
            {a.alerts.length} alert{a.alerts.length !== 1 ? "s" : ""}
            {a.openCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
                {a.openCount} open
              </span>
            )}
          </>
        }
      />

      <AlertsStatusFilter value={a.statusFilter} onChange={a.setStatusFilter} />

      {a.filtered.length === 0 ? (
        <AlertsEmpty statusFilter={a.statusFilter} />
      ) : (
        <div className="flex flex-col gap-3">
          {a.filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} closing={a.closingId === alert.id} onClose={a.handleClose} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
