import type { SqlClient } from "../lib/db";

interface DashboardContext {
  userId: string;
}

type Row = Record<string, unknown>;

function numberValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function firstRow(rows: Row[]): Row {
  return rows[0] ?? {};
}

// NOTE: the per-executive sales/visit/ageing rollups (daily_executive_performance,
// aging_snapshots) were dropped — they were never populated, so every figure they
// backed was already zero. These role dashboards keep the same shape and return
// those metrics as 0/empty; the live numbers come from /dashboard/metrics.

export async function getSuperAdminDashboard(
  sql: SqlClient,
  _context: DashboardContext,
) {
  // Two independent reads — one parallel batch, not two sequential round-trips.
  const [totalsRows, executivePerformance] = await Promise.all([
    sql`
      /* dashboard_totals */
      select
        (
          select count(*)::int
          from collections c
          where c.accountant_approval_status = 'pending'
        ) as "pendingCollections"
    `,
    sql`
    /* executive_performance */
    select
      u.id as "executiveId",
      u.name as "executiveName",
      case
        when exists (
          select 1
          from gps_tracking_sessions g
          where g.user_id = u.id and g.status = 'active'
        ) then 'active'
        else 'inactive'
      end as "gpsStatus"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    order by u.name
    limit 10
  `,
  ]);
  const totals = firstRow(totalsRows);

  return {
    role: "SUPER_ADMIN",
    metrics: {
      activeExecutives: 0,
      completedVisits: 0,
      productiveVisits: 0,
      salesValue: 0,
      collections: 0,
      pendingCollections: numberValue(totals.pendingCollections),
      overdueCustomers: 0,
    },
    executivePerformance: executivePerformance.map((row) => ({
      executiveId: stringValue(row.executiveId),
      executiveName: stringValue(row.executiveName),
      completedVisits: 0,
      productiveVisits: 0,
      salesValue: 0,
      collections: 0,
      gpsStatus: stringValue(row.gpsStatus),
    })),
    collectionRisk: [] as { bucket: string; customerCount: number; outstandingAmount: number }[],
  };
}

export async function getManagerDashboard(
  sql: SqlClient,
  _context: DashboardContext,
) {
  const totals = firstRow(
    await sql`
      /* manager_dashboard_totals */
      select
        (
          select count(*)::int
          from gps_tracking_sessions g
          where g.status = 'active'
        ) as "activeGpsSessions"
    `,
  );

  return {
    role: "MANAGER",
    metrics: {
      teamExecutives: 0,
      completedVisits: 0,
      productiveVisits: 0,
      salesValue: 0,
      collections: 0,
      activeGpsSessions: numberValue(totals.activeGpsSessions),
    },
  };
}

export async function getAccountantDashboard(
  sql: SqlClient,
  _context: DashboardContext,
) {
  const totals = firstRow(
    await sql`
      /* accountant_dashboard_totals */
      select
        count(*) filter (
          where accountant_approval_status = 'pending'
        )::int as "pendingVerification",
        count(*) filter (
          where accountant_approval_status = 'verified'
        )::int as "approvedCollections",
        count(*) filter (
          where accountant_approval_status = 'rejected'
        )::int as "rejectedCollections",
        coalesce(sum(collection_amount), 0)::numeric as "totalCollected"
      from collections
    `,
  );

  return {
    role: "ACCOUNTANT",
    metrics: {
      pendingVerification: numberValue(totals.pendingVerification),
      approvedCollections: numberValue(totals.approvedCollections),
      rejectedCollections: numberValue(totals.rejectedCollections),
      totalCollected: numberValue(totals.totalCollected),
      outstandingAmount: 0,
      overdueCustomers: 0,
    },
  };
}
