import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getActionConfig, listTrackedExecutives } from "../../../features/tracking/tracking-api";
import { TrackingView } from "../../../features/tracking/tracking-view";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "tracking")) {
    redirect(dashboardForRole(auth.role));
  }

  const { executives, date } = await listTrackedExecutives();
  const config = getActionConfig();

  return (
    <TrackingView
      initialExecutives={executives}
      initialDate={date}
      role={auth.role as "SUPER_ADMIN" | "MANAGER"}
      actionConfig={{ ...config, authToken }}
    />
  );
}
