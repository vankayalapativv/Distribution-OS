import { getApiAuthHeaders } from "../auth/server-session";
import { serverApiFetch } from "../../lib/server-api";

export type ErrorSource = "api" | "web" | "mobile";
export type ErrorStatus = "open" | "resolved" | "ignored";
export type ErrorLevel = "error" | "fatal" | "warning";

export interface ErrorGroupRow {
  id: string;
  fingerprint: string;
  source: ErrorSource;
  title: string;
  kind: string | null;
  level: ErrorLevel;
  status: ErrorStatus;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sampleRoute: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
}

export interface ErrorSummary {
  open: { groups: number; events: number };
  resolved: { groups: number; events: number };
  ignored: { groups: number; events: number };
  lastSeen: string | null;
}

export interface ErrorEvent {
  id: string;
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  requestId: string | null;
  userId: string | null;
  role: string | null;
  environment: string;
  appVersion: string | null;
  context: unknown;
  createdAt: string;
}

export interface ErrorNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
}

export interface ErrorGroupDetail {
  group: ErrorGroupRow & {
    sampleStack: string | null;
    resolvedBy: string | null;
    resolvedByName: string | null;
    resolvedAt: string | null;
  };
  events: ErrorEvent[];
  notes: ErrorNote[];
}

export interface ErrorAssignee {
  id: string;
  name: string;
  role: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

async function fetchApi(path: string): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  return serverApiFetch(path, { cache: "no-store", headers: authHeaders });
}

export async function errorSummary(): Promise<ErrorSummary> {
  const res = await fetchApi("/errors/summary");
  if (!res.ok) throw new Error(`Errors API failed with ${res.status}`);
  return ((await res.json()) as ApiSuccess<ErrorSummary>).data;
}

export async function listErrorGroups(
  status: string = "open",
): Promise<{ groups: ErrorGroupRow[]; total: number }> {
  const res = await fetchApi(`/errors?status=${encodeURIComponent(status)}`);
  if (!res.ok) throw new Error(`Errors API failed with ${res.status}`);
  const body = (await res.json()) as ApiSuccess<{ groups: ErrorGroupRow[]; total: number }>;
  return { groups: body.data.groups, total: body.data.total };
}

export async function listErrorAssignees(): Promise<ErrorAssignee[]> {
  const res = await fetchApi("/errors/assignees");
  if (!res.ok) throw new Error(`Errors API failed with ${res.status}`);
  return ((await res.json()) as ApiSuccess<{ assignees: ErrorAssignee[] }>).data.assignees;
}

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
