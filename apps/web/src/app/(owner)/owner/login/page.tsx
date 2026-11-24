import { redirect } from "next/navigation";
import { getAuthToken } from "../../../../features/auth/server-session";
import { AdminLoginForm } from "../../../../features/cockpit/admin-login-form";

export const dynamic = "force-dynamic";

export default async function OwnerLoginPage() {
  // Already signed in → straight to the cockpit (the page re-checks owner authz).
  const token = await getAuthToken();
  if (token) redirect("/owner");
  return <AdminLoginForm />;
}
