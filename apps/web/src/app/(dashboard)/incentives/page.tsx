import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { IncentivesPanel } from "../../../features/incentives/incentives-panel";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

export default async function IncentivesPage() {
  const auth = await requireSessionRole();

  if (!canAccessSection(auth, "incentives")) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <DashboardShell role={auth.role} active="incentives">
      <PageHeader
        title="Incentives"
        subtitle="Monthly incentives per sales executive — collections (% of verified collections) and targets (litre reward + per-litre rate)."
      />
      <IncentivesPanel actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }} />
    </DashboardShell>
  );
}
