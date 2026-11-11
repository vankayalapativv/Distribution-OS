import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";

interface AlertContext {
  userId: string;
}

export interface ListAlertsFilters {
  status?: string | null;
  severity?: string | null;
  alertType?: string | null;
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

function mapAlertRow(row: Row) {
  return {
    id: str(row.id),
    alertDate: str(row.alertDate),
    alertType: str(row.alertType),
    severity: str(row.severity),
    customerId: strOrNull(row.customerId),
    customerName: strOrNull(row.customerName),
    executiveId: strOrNull(row.executiveId),
    executiveName: strOrNull(row.executiveName),
    alertMessage: str(row.alertMessage),
    recommendedAction: strOrNull(row.recommendedAction),
    status: str(row.status),
    closedAt: strOrNull(row.closedAt),
    createdAt: str(row.createdAt),
  };
}

export async function listAlerts(
  sql: SqlClient,
  _context: AlertContext,
  filters: ListAlertsFilters = {},
) {
  const rows = await sql`
    /* list_alerts */
    select
      a.id,
      a.alert_date as "alertDate",
      a.alert_type as "alertType",
      a.severity,
      a.customer_id as "customerId",
      cu.legal_name as "customerName",
      a.executive_id as "executiveId",
      u.name as "executiveName",
      a.alert_message as "alertMessage",
      a.recommended_action as "recommendedAction",
      a.status,
      a.closed_at as "closedAt",
      a.created_at as "createdAt"
    from alerts a
    left join customers cu on cu.id = a.customer_id
    left join users u on u.id = a.executive_id
    where 1=1
    ${filters.status ? sql`and a.status = ${filters.status}` : sql``}
    ${filters.severity ? sql`and a.severity = ${filters.severity}` : sql``}
    ${filters.alertType ? sql`and a.alert_type = ${filters.alertType}` : sql``}
    order by a.created_at desc
    limit 100
  `;
  return rows.map(mapAlertRow);
}

export async function closeAlert(
  sql: SqlClient,
  context: AlertContext,
  id: string,
) {
  const [existing] = await sql`
    /* get_alert_by_id */
    select id from alerts where id = ${id}::uuid
  `;
  if (!existing) throw new ApiError("NOT_FOUND", "Alert not found.", 404);

  const [row] = await sql`
    /* close_alert */
    update alerts
    set
      status = 'closed',
      closed_by = ${context.userId}::uuid,
      closed_at = now(),
      updated_at = now()
    where id = ${id}::uuid
    returning
      id,
      alert_date as "alertDate",
      alert_type as "alertType",
      severity,
      customer_id as "customerId",
      executive_id as "executiveId",
      alert_message as "alertMessage",
      recommended_action as "recommendedAction",
      status,
      closed_at as "closedAt",
      created_at as "createdAt"
  `;
  return mapAlertRow(row);
}
