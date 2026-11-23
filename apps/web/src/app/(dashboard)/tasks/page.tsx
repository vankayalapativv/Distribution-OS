import { redirect } from "next/navigation";
import { canAccessSection, dashboardForRole, requireSessionRole } from "../../../features/auth/auth-role";
import {
  type CustomerLite,
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

  // The task form links to customers, but a role can hold Tasks without the
  // Customers section. Fetch customers only when permitted — otherwise the
  // /customers call 403s and crashes the page; fall back to an empty list.
  const customersFetch: Promise<CustomerLite[]> = canAccessSection(auth, "customers")
    ? listCustomersLite()
    : Promise.resolve([]);
  const [tasks, assignees, customers] = await Promise.all([
    listTasks(),
    listTaskAssignees(),
    customersFetch,
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
