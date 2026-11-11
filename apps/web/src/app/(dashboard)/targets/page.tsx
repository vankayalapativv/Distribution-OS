import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { TargetsPanel } from "../../../features/targets/targets-panel";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const auth = await requireSessionRole();

  if (!canAccessSection(auth, "targets")) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <DashboardShell role={auth.role} active="targets">
      <PageHeader
        title="Targets"
        subtitle="Weekly and monthly targets per sales executive — actual vs target, editable inline."
      />
      <TargetsPanel
        actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
      />
    </DashboardShell>
  );
}
