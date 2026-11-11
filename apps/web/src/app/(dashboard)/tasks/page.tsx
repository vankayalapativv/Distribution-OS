import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import {
  getActionConfig,
  listCustomersLite,
  listTaskAssignees,
  listTasks,
} from "../../../features/tasks/tasks-api";
import { TasksList } from "../../../features/tasks/tasks-list";
import { requireAuthToken } from "../../../features/auth/server-session";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const auth = await requireSessionRole();
  const authToken = await requireAuthToken();

  if (!canAccessSection(auth, "tasks")) {
    redirect(dashboardForRole(auth.role));
  }

  const [tasks, assignees, customers] = await Promise.all([
    listTasks(),
    listTaskAssignees(),
    listCustomersLite(),
  ]);
  const config = getActionConfig();

  return (
    <TasksList
      tasks={tasks}
      assignees={assignees}
      customers={customers}
      role={auth.role as "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT"}
      actionConfig={{ ...config, authToken, currentUserId: auth.userId ?? "" }}
    />
  );
}
