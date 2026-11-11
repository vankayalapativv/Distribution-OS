import { redirect } from "next/navigation";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getAuditActionConfig } from "../../../features/audit-logs/audit-logs-api";
import { AuditLogsList } from "../../../features/audit-logs/audit-logs-list";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  // SUPER_ADMIN only.
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }

  const config = getAuditActionConfig();
  return <AuditLogsList actionConfig={{ ...config, authToken }} />;
}
