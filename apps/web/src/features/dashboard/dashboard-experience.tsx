import { DashboardShell } from "@/features/shell/dashboard-shell";
import { MetricsDashboard, type DashboardMetrics, type MetricsActionConfig } from "./metrics-dashboard";
import { ExecutivePerformanceTable } from "./executive-performance";
import { LegacyMetricCards } from "./legacy-metric-cards";
import { displayName, getFormattedDate, getTimeGreeting } from "./dashboard-greeting";
import type { DashboardExperienceData, WebDashboardRole } from "./dashboard-experience-types";

// Re-exported so existing `./dashboard-experience` type imports keep working.
export type {
  WebDashboardRole,
  DashboardMetric,
  ExecutivePerformanceRow,
  DashboardExperienceData,
} from "./dashboard-experience-types";

interface DashboardExperienceProps {
  readonly role: WebDashboardRole;
  /** The signed-in user's own name for the greeting; falls back to the role label. */
  readonly userName?: string;
  readonly dashboardData: DashboardExperienceData;
  /** When present (SUPER_ADMIN / MANAGER), the live metrics dashboard with
   *  drill-down dialogs replaces the legacy cards + performance table. */
  readonly metrics?: { actionConfig: MetricsActionConfig; initial: DashboardMetrics };
}

export function DashboardExperience({ role, userName, dashboardData, metrics }: DashboardExperienceProps) {
  return (
    <DashboardShell role={role} active="dashboard" contentClassName="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">

      <div className="mb-7">
        <h1 className="text-2xl font-bold text-foreground">
          {getTimeGreeting()}, {displayName(role, userName)}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{getFormattedDate()}</p>
      </div>

      {metrics ? (
        <MetricsDashboard actionConfig={metrics.actionConfig} initialMetrics={metrics.initial} />
      ) : (
        <LegacyMetricCards metrics={dashboardData.metrics} />
      )}

      {!metrics && dashboardData.executivePerformance.length > 0 && (
        <ExecutivePerformanceTable rows={dashboardData.executivePerformance} />
      )}
    </DashboardShell>
  );
}
