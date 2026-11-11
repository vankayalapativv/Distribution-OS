import { redirect } from "next/navigation";
import { getSuperAdminSetupData } from "../../../../features/super-admin/super-admin-api";
import { requireAuthToken } from "../../../../features/auth/server-session";
import { dashboardForRole, requireSessionRole } from "../../../../features/auth/auth-role";
import { SuperAdminSetup } from "../../../../features/super-admin/super-admin-setup";

export const dynamic = "force-dynamic";

export default async function SuperAdminSetupPage() {
  const auth = await requireSessionRole();
  // Users & Teams is SUPER_ADMIN only — send anyone else to their own dashboard
  // (previously this relied on the nav hiding it, so a direct hit 500'd).
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();
  const setupData = await getSuperAdminSetupData();

  return (
    <SuperAdminSetup
      actionConfig={{
        apiBaseUrl:
          process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
        authToken,
      }}
      setupData={setupData}
      currentUserId={auth.userId}
    />
  );
}
