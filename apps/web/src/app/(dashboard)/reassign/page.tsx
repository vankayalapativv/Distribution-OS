import { redirect } from "next/navigation";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { DashboardShell } from "../../../features/shell/dashboard-shell";
import {
  getActionConfig,
  listCustomersForPicker,
} from "../../../features/reassign/reassign-api";
import { ReassignView } from "../../../features/reassign/reassign-view";

export const dynamic = "force-dynamic";

/** Reassign a customer's ownership between sales executives — SUPER_ADMIN only. */
export default async function ReassignPage() {
  const auth = await requireSessionRole();
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }
  const authToken = await requireAuthToken();
  const customers = await listCustomersForPicker();
  const config = getActionConfig();

  return (
    <DashboardShell role={auth.role} active="reassign">
      <ReassignView customers={customers} actionConfig={{ ...config, authToken }} />
    </DashboardShell>
  );
}
