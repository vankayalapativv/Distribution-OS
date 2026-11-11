import { redirect } from "next/navigation";
import { getAuthToken } from "../../features/auth/server-session";
import { LoginExperience } from "../../features/auth/login-experience";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const [token, params] = await Promise.all([getAuthToken(), searchParams]);

  if (token) {
    redirect("/auth/redirect");
  }

  return <LoginExperience error={params.error} />;
}
