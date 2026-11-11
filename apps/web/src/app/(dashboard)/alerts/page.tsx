import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { listAlerts, getActionConfig } from "../../../features/alerts/alerts-api";
import { AlertsList } from "../../../features/alerts/alerts-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "alerts")) {
    redirect(dashboardForRole(auth.role));
  }

  const alerts = await listAlerts();
  const config = getActionConfig();

  return (
    <AlertsList
      alerts={alerts}
      role={auth.role as "SUPER_ADMIN" | "MANAGER"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
