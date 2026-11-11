import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { getActionConfig } from "../../../features/customers/customers-api";
import { CustomersList } from "../../../features/customers/customers-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "customers")) {
    redirect(dashboardForRole(auth.role));
  }

  // Table data is fetched client-side with TanStack Query (see customers-list).
  const config = getActionConfig();

  return (
    <CustomersList
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
