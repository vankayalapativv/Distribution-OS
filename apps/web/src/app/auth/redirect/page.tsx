import { redirect } from "next/navigation";
import { getAuthToken } from "../../../features/auth/server-session";
import {
  getOnboardingState,
  getSessionRole,
  landingPathFor,
} from "../../../features/auth/auth-role";

export const dynamic = "force-dynamic";

export default async function AuthRedirectPage() {
  // Gate on the session token, NOT on getSessionRole: a valid session whose account
  // has no app role yet (a fresh signup with no users row, or a bootstrap gap)
  // makes getSessionRole null, which is NOT "unauthenticated" — a token exists. If
  // we bounced that to /login, /login would send it straight back here (a token is
  // present) → ERR_TOO_MANY_REDIRECTS.
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }

  // Route by onboarding state, not role alone: a half-finished signup resumes the
  // wizard, a submitted/rejected one sees its status, and only an active-enterprise
  // web role reaches the dashboard. A non-web role on an active enterprise
  // (SALES_EXECUTIVE / LOGISTICS) routes to the logout endpoint so its cookie is
  // cleared before /login. Role defaults to null when getSessionRole can't resolve.
  const [auth, state] = await Promise.all([getSessionRole(), getOnboardingState()]);
  redirect(landingPathFor(auth?.role ?? null, state));
}
