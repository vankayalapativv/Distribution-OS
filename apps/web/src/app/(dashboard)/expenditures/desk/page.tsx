import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../../features/auth/auth-role";
import { requireAuthToken } from "../../../../features/auth/server-session";
import { getActionConfig } from "../../../../features/expenditures/expenditures-api";
import { ExpenditureDesk } from "../../../../features/expenditures/expenditure-desk";

export const dynamic = "force-dynamic";

/** Expense desk — Claims / Advances / Salary & pay / Employee ledger in one tabbed
 *  page, reached from the Expenditure page's ⋮ menu. Office roles only; each tab
 *  is further gated by its own capability. */
export default async function ExpenditureDeskPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "expenditures")) {
    redirect(dashboardForRole(auth.role));
  }

  const config = getActionConfig();

  return (
    <ExpenditureDesk
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
