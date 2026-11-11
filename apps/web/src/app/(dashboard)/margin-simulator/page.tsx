import { redirect } from "next/navigation";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import {
  getMarginActionConfig,
  loadOilProducts,
  loadSimulations,
} from "../../../features/margin-simulator/margin-api";
import { MarginSimulatorContent } from "../../../features/margin-simulator/margin-content";

export const dynamic = "force-dynamic";

export default async function MarginSimulatorRoute() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  // Super-admin-only tool.
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }

  // Start the fetches but DON'T await — the promises stream to the client, which
  // resolves them with use(). The shell, header, search box and New-simulation
  // button render immediately; only the table rows (and the dialog's product
  // list) wait on their data.
  const simsPromise = loadSimulations();
  const productsPromise = loadOilProducts();

  return (
    <DashboardShell role="SUPER_ADMIN" active="margin-simulator">
      <PageHeader
        title="Margin Simulator"
        subtitle="Model net margin per pack & per litre for oils. Saved scenarios stay here to reopen and compare."
      />
      <MarginSimulatorContent
        simsPromise={simsPromise}
        productsPromise={productsPromise}
        actionConfig={{ ...getMarginActionConfig(), authToken }}
      />
    </DashboardShell>
  );
}
