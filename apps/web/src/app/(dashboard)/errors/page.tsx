import { redirect } from "next/navigation";
import { dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import { requireAuthToken } from "../../../features/auth/server-session";
import {
  errorSummary,
  getActionConfig,
  listErrorAssignees,
  listErrorGroups,
} from "../../../features/errors/errors-api";
import { ErrorsView } from "../../../features/errors/errors-view";

export const dynamic = "force-dynamic";

/** The in-house error monitor is a SUPER_ADMIN-only surface. */
export default async function ErrorsPage() {
  const auth = await requireSessionRole();
  if (auth.role !== "SUPER_ADMIN") {
    redirect(dashboardForRole(auth.role));
  }
  const authToken = await requireAuthToken();

  const [summary, list, assignees] = await Promise.all([
    errorSummary(),
    listErrorGroups("open"),
    listErrorAssignees(),
  ]);
  const config = getActionConfig();

  return (
    <ErrorsView
      summary={summary}
      groups={list.groups}
      assignees={assignees}
      actionConfig={{ ...config, authToken, currentUserId: auth.userId ?? "" }}
    />
  );
}
