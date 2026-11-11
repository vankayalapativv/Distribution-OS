import { redirect } from "next/navigation";
import { StockJournal } from "../../../features/stock/stock-journal";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getMetricsApiBaseUrl } from "../../../features/dashboard/dashboard-api";

export const dynamic = "force-dynamic";

const OFFICE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

export default async function StockPage() {
  const auth = await requireSessionRole();

  if (!OFFICE_ROLES.includes(auth.role as (typeof OFFICE_ROLES)[number])) {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  return (
    <StockJournal
      role={auth.role as (typeof OFFICE_ROLES)[number]}
      actionConfig={{ apiBaseUrl: getMetricsApiBaseUrl(), authToken }}
    />
  );
}
