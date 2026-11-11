import { redirect } from "next/navigation";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { ReportsViewLazy } from "../../../features/reports/reports-view-lazy";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const auth = await requireSessionRole();

  if (!canAccessSection(auth, "reports")) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <DashboardShell role={auth.role} active="reports">
      <ReportsViewLazy
        actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
        role={auth.role}
      />
    </DashboardShell>
  );
}
