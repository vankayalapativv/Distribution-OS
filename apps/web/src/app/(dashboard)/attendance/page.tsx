import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import { getActionConfig } from "../../../features/attendance/attendance-api";
import { AttendanceView } from "../../../features/attendance/attendance-view";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "attendance")) {
    redirect(dashboardForRole(auth.role));
  }

  const config = getActionConfig();

  return (
    <AttendanceView
      role={auth.role}
      actionConfig={{ ...config, authToken }}
    />
  );
}
