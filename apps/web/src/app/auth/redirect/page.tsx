import { redirect } from "next/navigation";
import {
  dashboardForRole,
  getSessionRole,
  isWebRole,
} from "../../../features/auth/auth-role";

export const dynamic = "force-dynamic";

export default async function AuthRedirectPage() {
  const auth = await getSessionRole();

  if (!auth || !auth.isAuthenticated) {
    redirect("/login");
  }

  // A non-web role (SALES_EXECUTIVE / LOGISTICS) has no web app. Clear their
  // session via the logout route (a server component can't mutate cookies) and
  // land on /login with the reason — otherwise the stale cookie ping-pongs
  // between /login and here forever (ERR_TOO_MANY_REDIRECTS).
  if (!isWebRole(auth.role)) {
    redirect("/api/auth/logout?error=no_web_access");
  }

  redirect(dashboardForRole(auth.role));
}
