import { redirect } from "next/navigation";
import { requireAuthToken } from "@/features/auth/server-session";
import { dashboardForRole, requireSessionRole } from "@/features/auth/auth-role";
import { SuperAdminSetup } from "@/features/super-admin/super-admin-setup";

export const dynamic = "force-dynamic";

export default async function SuperAdminSetupPage() {
  const auth = await requireSessionRole();
  // Users is SUPER_ADMIN only — send anyone else to their own dashboard
  // (previously this relied on the nav hiding it, so a direct hit 500'd).
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }

  const authToken = await requireAuthToken();

  // The table is client-fetched via TanStack Query (GET /super-admin/users/paged),
  // so the server component only hands down the API action config — no list data.
  return (
    <SuperAdminSetup
      actionConfig={{
        apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
        authToken,
      }}
      currentUserId={auth.userId}
    />
  );
}
