import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getActionConfig } from "../../../features/logistics/logistics-api";
import { LogisticsList } from "../../../features/logistics/logistics-list";

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "logistics")) {
    redirect(dashboardForRole(auth.role));
  }

  // Table data is fetched client-side with TanStack Query (see logistics-list).
  // The server component only hands down the API base + auth token.
  const config = getActionConfig();

  return (
    <LogisticsList
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
