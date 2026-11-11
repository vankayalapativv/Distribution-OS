import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { DashboardExperience } from "@/features/dashboard/dashboard-experience";
import {
  fetchMyName,
  getDashboardExperienceData,
  getInitialDashboardMetrics,
  getMetricsApiBaseUrl,
} from "@/features/dashboard/dashboard-api";
import { requireSessionRole } from "@/features/auth/auth-role";
import { requireAuthToken } from "@/features/auth/server-session";

export const dynamic = "force-dynamic";

/**
 * Role-neutral home ("/"). Everyone lands here after login; the page renders
 * their dashboard from the session role — the role is never in the URL. Replaces
 * the old per-role /dashboard/{role} landing pages.
 */
export default async function Home() {
  const auth = await requireSessionRole(); // redirects to /login if unauthenticated

  if (auth.role === "SUPER_ADMIN" || auth.role === "MANAGER") {
    const [dashboardData, initialMetrics, authToken, userName] = await Promise.all([
      getDashboardExperienceData(auth.role),
      getInitialDashboardMetrics(),
      requireAuthToken(),
      fetchMyName(),
    ]);
    return (
      <DashboardExperience
        role={auth.role}
        userName={userName}
        dashboardData={dashboardData}
        metrics={{
          actionConfig: { apiBaseUrl: getMetricsApiBaseUrl(), authToken },
          initial: initialMetrics,
        }}
      />
    );
  }

  if (auth.role === "ACCOUNTANT") {
    return (
      <DashboardShell role="ACCOUNTANT" active="dashboard">
        <PageHeader title="Overview" subtitle="Your dashboard is being set up." />
        <div className="rounded-xl border border-border bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            A dedicated accountant overview is coming soon. In the meantime, use the sidebar to
            reach Collections, Invoices, Outstanding, and Reports.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // SALES_EXECUTIVE / LOGISTICS have no web dashboard. Clear the stale session
  // (via the logout route) so it doesn't loop back through /auth/redirect.
  redirect("/api/auth/logout?error=no_web_access");
}
