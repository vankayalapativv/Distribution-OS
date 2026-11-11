import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";
import type { CustomerLite, Task, TaskAssignee } from "./tasks-types";

// Re-exported so existing `from "./tasks-api"` imports keep working; the type
// definitions now live in ./tasks-types.
export type { Task, TaskComment, TaskAttachment, TaskAssignee, CustomerLite } from "./tasks-types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function listTasks(): Promise<Task[]> {
  const response = await fetchApi("/tasks");
  if (!response.ok) throw new Error(`Tasks API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ tasks: Task[] }>;
  return body.data.tasks;
}

export async function listTaskAssignees(): Promise<TaskAssignee[]> {
  const response = await fetchApi("/tasks/assignees");
  if (!response.ok) throw new Error(`Tasks API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<{ assignees: TaskAssignee[] }>;
  return body.data.assignees;
}

interface CustomerLiteApi {
  id: string;
  legalName: string;
  customerCode: string;
  addressCity: string | null;
  salesExecutiveName: string | null;
}

export async function listCustomersLite(): Promise<CustomerLite[]> {
  const response = await fetchApi("/customers");
  if (!response.ok) throw new Error(`Customers API failed with ${response.status}`);
  const body = (await response.json()) as ApiSuccess<CustomerLiteApi[]>;
  return body.data.map((c) => ({
    id: c.id,
    legalName: c.legalName,
    customerCode: c.customerCode,
    city: c.addressCity ?? null,
    salesExecutiveName: c.salesExecutiveName ?? null,
  }));
}

export function getActionConfig(): { apiBaseUrl: string } {
  return { apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1" };
}
