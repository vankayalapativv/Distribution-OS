import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../../features/auth/auth-role";
import { requireAuthToken } from "../../../../features/auth/server-session";
import { getActionConfig } from "../../../../features/expenditures/expenditures-api";
import { ExpenditureClaimsPage } from "../../../../features/expenditures/expenditure-claims-page";

export const dynamic = "force-dynamic";

/** Claims — field expense claims awaiting approval, reached from the Expenditure
 *  page's Claims button. Office roles only. */
export default async function ExpenditureClaimsRoute() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "expenditures")) {
    redirect(dashboardForRole(auth.role));
  }

  const config = getActionConfig();

  return (
    <ExpenditureClaimsPage
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
