import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getActionConfig } from "../../../features/expenditures/expenditures-api";
import { ExpendituresList } from "../../../features/expenditures/expenditures-list";

export const dynamic = "force-dynamic";

/** Expenditure — all three office roles can view and record (2026-07-24). */
export default async function ExpendituresPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "expenditures")) {
    redirect(dashboardForRole(auth.role));
  }

  const config = getActionConfig();

  return (
    <ExpendituresList
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
