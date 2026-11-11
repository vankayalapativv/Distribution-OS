export interface AuditLog {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  metadata: unknown;
}

/** Distinct values present in the log — for the filter dropdowns. */
export interface AuditFilterOptions {
  actors: { id: string; name: string }[];
  entityTypes: string[];
  actions: string[];
}

/** Server-passed API base for the client table (auth token added by the page). */
export function getAuditActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
