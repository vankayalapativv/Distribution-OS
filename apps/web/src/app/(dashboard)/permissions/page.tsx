import { redirect } from "next/navigation";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { DashboardShell } from "../../../features/shell/dashboard-shell";
import { getActionConfig, getPermissionMatrix } from "../../../features/permissions/permissions-api";
import { PermissionsView } from "../../../features/permissions/permissions-view";

export const dynamic = "force-dynamic";

/** Role-permission management — SUPER_ADMIN only. */
export default async function PermissionsPage() {
  const auth = await requireSessionRole();
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }
  const authToken = await requireAuthToken();
  const matrix = await getPermissionMatrix();
  const config = getActionConfig();

  return (
    <DashboardShell role={auth.role} active="permissions">
      <PermissionsView matrix={matrix} actionConfig={{ ...config, authToken }} />
    </DashboardShell>
  );
}
