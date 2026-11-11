import { redirect } from "next/navigation";
import { getAuthToken } from "../../features/auth/server-session";
import { SignupForm } from "../../features/onboarding/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Already signed in → continue onboarding (or the dashboard, decided there).
  const token = await getAuthToken();
  if (token) redirect("/onboarding");
  return <SignupForm />;
}
