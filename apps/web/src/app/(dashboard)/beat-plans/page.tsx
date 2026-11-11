import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { BeatPlansPanel } from "../../../features/beat-plans/beat-plans-panel";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

export default async function BeatPlansPage() {
  const auth = await requireSessionRole();

  if (!canAccessSection(auth, "beat-plans")) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <DashboardShell
      role={auth.role}
      active="beat-plans"
      // Cap the content to the viewport (below the h-14 top bar) and clip it, so
      // the board's columns fill the height and scroll INTERNALLY instead of
      // growing the whole page.
      contentClassName="flex h-[calc(100vh-3.5rem)] flex-col gap-6 overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
    >
      <PageHeader
        title="Beat Plans"
        subtitle="Each executive's recurring Monday–Saturday visit route."
      />
      <BeatPlansPanel
        actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
      />
    </DashboardShell>
  );
}
