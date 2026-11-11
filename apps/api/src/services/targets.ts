import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function isoDate(v: unknown): string {
  return str(v).slice(0, 10);
}

/**
 * Targets (rebuilt 2026-07-25): oils are a litre target PER SEGMENT (from
 * orders — the segment the SE picked on each line).
 */
export const OIL_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

export type OilSegment = (typeof OIL_SEGMENTS)[number];

export interface SegmentLitres {
  segment: string;
  litres: number;
}

/** One period's performance: per-segment oil. */
export interface PeriodPerformance {
  periodStart: string;
  oilActual: SegmentLitres[];
  oilTarget: SegmentLitres[] | null;
}

export interface TargetUpsertInput {
  periodType: "week" | "month";
  /** Any date inside the period — normalized to Monday / 1st server-side. */
  periodDate: string | null;
  /** Litre target per segment; missing segments default to 0. */
  segments: { segment: string; litres: number }[];
}

/** Fill every canonical segment (zeros where absent) in canonical order. */
function fillSegments(map: Map<string, number>): SegmentLitres[] {
  return OIL_SEGMENTS.map((segment) => ({ segment, litres: map.get(segment) ?? 0 }));
}

/**
 * Per-segment oil litres from orders for today / current week / current month
 * (IST days; weeks start Monday). Litres = qty × pack size on oil lines, grouped
 * by the order-line segment (one segment per line — no double counting).
 *
 * Quantity-unit products never inflate this: their order lines store
 * `total_litres = NULL`, so `sum(oi.total_litres - …)` skips them entirely — their
 * sales value lands in the separate "Other products" value slot instead. Covered
 * by orders-prepare-items.test.ts (total_litres is null for quantity products).
 */
async function getOilActuals(sql: SqlClient, userId: string) {
  const rows = (await sql`
    /* targets_oil_actuals_by_segment */
    with bounds as (
      select
        (now() at time zone 'Asia/Kolkata')::date as today,
        date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date as wstart,
        date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart
    )
    select
      oi.segment as "segment",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date = b.today), 0)::numeric   as "todayLitres",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.wstart), 0)::numeric as "weekLitres",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.mstart), 0)::numeric as "monthLitres"
    from bounds b
    join orders o
      on o.sales_executive_id = ${userId}::uuid
      and o.order_date between least(b.wstart, b.mstart) and b.today
      and o.order_status <> 'cancelled'
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    -- Net out returned litres per order line (returns reverse the SE's sale in
    -- the ORIGINAL order period, since the subtraction rides on the order date).
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items
      where kind = 'oil'
      group by order_item_id
    ) ret on ret.order_item_id = oi.id
    group by oi.segment
  `) as Row[];

  const today = new Map<string, number>();
  const week = new Map<string, number>();
  const month = new Map<string, number>();
  for (const r of rows) {
    const seg = str(r.segment);
    if (!seg) continue;
    today.set(seg, (today.get(seg) ?? 0) + num(r.todayLitres));
    week.set(seg, (week.get(seg) ?? 0) + num(r.weekLitres));
    month.set(seg, (month.get(seg) ?? 0) + num(r.monthLitres));
  }
  return { today, week, month };
}

/** Period boundaries as ISO strings for the current IST week/month. */
async function currentPeriods(sql: SqlClient) {
  const [row] = (await sql`
    /* targets_current_periods */
    select
      (now() at time zone 'Asia/Kolkata')::date::text as "today",
      date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date::text as "weekStart",
      date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date::text as "monthStart"
  `) as Row[];
  return {
    today: isoDate(row?.today),
    weekStart: isoDate(row?.weekStart),
    monthStart: isoDate(row?.monthStart),
  };
}

/** This SE's saved segment oil targets for the current periods. */
async function getTargetsFor(sql: SqlClient, userId: string) {
  const rows = (await sql`
    /* get_current_targets */
    select
      t.period_type as "periodType",
      st.segment as "segment",
      st.target_litres as "litres"
    from se_targets t
    left join se_segment_targets st on st.se_target_id = t.id
    where t.user_id = ${userId}::uuid
      and (
        (t.period_type = 'week'  and t.period_start = date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date)
        or
        (t.period_type = 'month' and t.period_start = date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date)
      )
  `) as Row[];

  function build(periodType: "week" | "month") {
    const forPeriod = rows.filter((r) => str(r.periodType) === periodType);
    if (forPeriod.length === 0) return null;
    const map = new Map<string, number>();
    for (const r of forPeriod) {
      const seg = str(r.segment);
      if (seg) map.set(seg, num(r.litres));
    }
    return {
      oil: fillSegments(map),
    };
  }
  return { week: build("week"), month: build("month") };
}

/** SE Home screen payload: today actuals + week/month actual-vs-target. */
export interface CollectionActual {
  /** ₹ collected in the period (pending + verified; excludes rejected). */
  total: number;
  /** ₹ of that which the accountant has verified. */
  verified: number;
}

/** SE's own collections (collected_by) by period: today / week / month (IST). */
async function getCollectionActuals(sql: SqlClient, userId: string) {
  const [row] = (await sql`
    /* targets_collection_actuals */
    with bounds as (
      select
        (now() at time zone 'Asia/Kolkata')::date as today,
        date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date as wstart,
        date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart
    )
    select
      coalesce(sum(c.collection_amount) filter (where c.collection_date = b.today), 0)::numeric as "todayTotal",
      coalesce(sum(c.collection_amount) filter (where c.collection_date = b.today and c.accountant_approval_status = 'verified'), 0)::numeric as "todayVerified",
      coalesce(sum(c.collection_amount) filter (where c.collection_date >= b.wstart), 0)::numeric as "weekTotal",
      coalesce(sum(c.collection_amount) filter (where c.collection_date >= b.wstart and c.accountant_approval_status = 'verified'), 0)::numeric as "weekVerified",
      coalesce(sum(c.collection_amount) filter (where c.collection_date >= b.mstart), 0)::numeric as "monthTotal",
      coalesce(sum(c.collection_amount) filter (where c.collection_date >= b.mstart and c.accountant_approval_status = 'verified'), 0)::numeric as "monthVerified"
    from bounds b
    left join collections c
      on c.collected_by_user_id = ${userId}::uuid
      and c.collection_date between least(b.wstart, b.mstart) and b.today
      and coalesce(c.accountant_approval_status, 'pending') <> 'rejected'
  `) as Row[];
  const pick = (t: string, v: string): CollectionActual => ({ total: num(row?.[t]), verified: num(row?.[v]) });
  return {
    today: pick("todayTotal", "todayVerified"),
    week: pick("weekTotal", "weekVerified"),
    month: pick("monthTotal", "monthVerified"),
  };
}

export async function getMyPerformance(sql: SqlClient, context: { userId: string }) {
  const [oil, collections, periods, targets] = await Promise.all([
    getOilActuals(sql, context.userId),
    getCollectionActuals(sql, context.userId),
    currentPeriods(sql),
    getTargetsFor(sql, context.userId),
  ]);

  const week: PeriodPerformance = {
    periodStart: periods.weekStart,
    oilActual: fillSegments(oil.week),
    oilTarget: targets.week?.oil ?? null,
  };
  const month: PeriodPerformance = {
    periodStart: periods.monthStart,
    oilActual: fillSegments(oil.month),
    oilTarget: targets.month?.oil ?? null,
  };

  return {
    today: {
      date: periods.today,
      oilActual: fillSegments(oil.today),
      collections: collections.today,
    },
    week: { ...week, collections: collections.week },
    month: { ...month, collections: collections.month },
  };
}

/** Normalize any date to its period start (Monday for week, 1st for month). */
async function periodStartOf(sql: SqlClient, periodType: "week" | "month", date: string) {
  const [row] = (await sql`
    /* target_period_start */
    select date_trunc(${periodType}, ${date}::date)::date::text as "s"
  `) as Row[];
  return isoDate(row?.s);
}

export interface PeriodMeta {
  periodType: "week" | "month";
  periodStart: string;
  isCurrent: boolean;
  isFuture: boolean;
  /** Current + future periods are editable; past periods are read-only. */
  canEdit: boolean;
}

export interface ExecutivePeriodTargets {
  userId: string;
  name: string;
  perf: PeriodPerformance;
  /** The SE's current-period target (for the "Copy from current" convenience). */
  currentTarget: { oil: SegmentLitres[] } | null;
}

/** Inclusive period end for a period start: week = +6 days, month = last day. */
function periodEndDate(periodType: "week" | "month", start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (periodType === "week") {
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  }
  // Day 0 of the next month = the last day of this month.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Per-SE per-segment oil litres (net of returns) for an explicit date window —
 * the historical generalization of `getOilActuals`, aggregated across all SEs
 * in one query (keyed by user). Same rule as the live metric, any period.
 */
async function getPeriodOilActualsByUser(sql: SqlClient, start: string, end: string) {
  const rows = (await sql`
    /* targets_period_oil_by_user */
    select
      o.sales_executive_id as "userId",
      oi.segment as "segment",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0)::numeric as "litres"
    from orders o
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items where kind = 'oil' group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where o.sales_executive_id is not null
      and o.order_status <> 'cancelled'
      and o.order_date between ${start}::date and ${end}::date
    group by o.sales_executive_id, oi.segment
  `) as Row[];
  const byUser = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const uid = str(r.userId);
    const seg = str(r.segment);
    if (!uid || !seg) continue;
    if (!byUser.has(uid)) byUser.set(uid, new Map());
    byUser.get(uid)!.set(seg, num(r.litres));
  }
  return byUser;
}

interface PeriodTarget {
  userId: string;
  name: string;
  oil: SegmentLitres[];
}

/** Every SE that has a target for the period (with name), oldest-name order. */
async function getAllTargetsForPeriod(
  sql: SqlClient,
  periodType: "week" | "month",
  periodStart: string,
): Promise<PeriodTarget[]> {
  const rows = (await sql`
    /* targets_all_for_period */
    select
      t.user_id as "userId",
      u.name as "name",
      st.segment as "segment",
      st.target_litres as "litres"
    from se_targets t
    join users u on u.id = t.user_id
    left join se_segment_targets st on st.se_target_id = t.id
    where t.period_type = ${periodType} and t.period_start = ${periodStart}::date
    order by u.name
  `) as Row[];
  const order: string[] = [];
  const info = new Map<string, { name: string }>();
  const segMaps = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const uid = str(r.userId);
    if (!info.has(uid)) {
      info.set(uid, { name: str(r.name) });
      segMaps.set(uid, new Map());
      order.push(uid);
    }
    const seg = str(r.segment);
    if (seg) segMaps.get(uid)!.set(seg, num(r.litres));
  }
  return order.map((uid) => ({
    userId: uid,
    name: info.get(uid)!.name,
    oil: fillSegments(segMaps.get(uid)!),
  }));
}

/**
 * Admin Targets page: SEs' target-vs-actual for ONE selected period. For the
 * current period and any PAST period, real actuals are computed (bounded to
 * that period, same rules as the live metric). Future periods are target-only.
 * Past periods list ONLY the SEs that had a target (pure target-vs-actual);
 * current/future list every active SE (so targets can be set).
 */
export async function listExecutiveTargets(
  sql: SqlClient,
  opts: { periodType: "week" | "month"; periodStart?: string | null },
): Promise<{ period: PeriodMeta; executives: ExecutivePeriodTargets[] }> {
  // The active-SE roster doesn't depend on the period, so fetch it in the same
  // parallel batch as the period lookup (each is a ~50ms Neon round-trip). Neon
  // query promises are LAZY — they only run once awaited — so the two must share
  // one Promise.all to actually run concurrently. The roster is used for every
  // case except a past period (which rosters off the targets instead), so at most
  // one query is wasted on the rarer past-period path.
  const [periods, rosterSes] = await Promise.all([
    currentPeriods(sql),
    sql`
      /* list_target_ses */
      select u.id, u.name
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
      order by u.name
    ` as Promise<Row[]>,
  ]);
  const currentStart = opts.periodType === "week" ? periods.weekStart : periods.monthStart;
  const requestedStart = opts.periodStart
    ? await periodStartOf(sql, opts.periodType, opts.periodStart)
    : currentStart;
  const isCurrent = requestedStart === currentStart;
  const isFuture = requestedStart > currentStart;
  const isPast = requestedStart < currentStart;
  const end = periodEndDate(opts.periodType, requestedStart);

  // Requested-period targets and the period's oil actuals are independent of each
  // other (both need only the resolved period), so fetch them as one parallel batch.
  const [requestedTargets, oilByUser] = await Promise.all([
    getAllTargetsForPeriod(sql, opts.periodType, requestedStart),
    isFuture
      ? Promise.resolve(new Map<string, Map<string, number>>())
      : getPeriodOilActualsByUser(sql, requestedStart, end),
  ]);
  const requestedMap = new Map(requestedTargets.map((t) => [t.userId, t]));

  // Roster: past → only SEs that had a target; current/future → all active SEs.
  let roster: { userId: string; name: string }[];
  if (isPast) {
    // Roster comes from the targets here; the already-fetched SE list is unused.
    roster = requestedTargets.map((t) => ({ userId: t.userId, name: t.name }));
  } else {
    roster = rosterSes.map((s) => ({ userId: str(s.id), name: str(s.name) }));
  }

  // The current-period target powers the edit dialog's "Copy from current".
  const currentMap = isCurrent
    ? requestedMap
    : new Map(
        (await getAllTargetsForPeriod(sql, opts.periodType, currentStart)).map((t) => [t.userId, t]),
      );

  const executives: ExecutivePeriodTargets[] = roster.map((se) => {
    const selected = requestedMap.get(se.userId) ?? null;
    const currentT = isCurrent ? selected : (currentMap.get(se.userId) ?? null);
    return {
      userId: se.userId,
      name: se.name,
      perf: {
        periodStart: requestedStart,
        oilActual: fillSegments(oilByUser.get(se.userId) ?? new Map()),
        oilTarget: selected?.oil ?? null,
      },
      currentTarget: currentT ? { oil: currentT.oil } : null,
    };
  });

  return {
    period: {
      periodType: opts.periodType,
      periodStart: requestedStart,
      isCurrent,
      isFuture,
      canEdit: requestedStart >= currentStart,
    },
    executives,
  };
}

/** Upsert one SE's per-segment oil targets for a period. */
export async function upsertTarget(
  sql: SqlClient,
  context: { userId: string },
  targetUserId: string,
  input: TargetUpsertInput,
) {
  if (input.periodType !== "week" && input.periodType !== "month") {
    throw new ApiError("INVALID_FIELD", "periodType must be 'week' or 'month'.", 422);
  }
  const segmentMap = new Map<string, number>();
  for (const s of input.segments) {
    if (!(OIL_SEGMENTS as readonly string[]).includes(s.segment)) {
      throw new ApiError("INVALID_FIELD", `Unknown segment: ${s.segment}.`, 422);
    }
    if (!Number.isFinite(s.litres) || s.litres < 0) {
      throw new ApiError("INVALID_FIELD", `${s.segment} litres must be zero or positive.`, 422);
    }
    segmentMap.set(s.segment, s.litres);
  }

  const [user] = (await sql`
    /* target_user_exists */
    select u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${targetUserId}::uuid and r.code = 'SALES_EXECUTIVE'
    limit 1
  `) as Row[];
  if (!user) throw new ApiError("NOT_FOUND", "Sales executive not found.", 404);

  // Targets can only be set for the current or an upcoming period, never a past one.
  const [periodRow] = (await sql`
    /* target_period_guard */
    select
      date_trunc(${input.periodType}, coalesce(${input.periodDate}::date, (now() at time zone 'Asia/Kolkata')::date))::date::text as "start",
      date_trunc(${input.periodType}, (now() at time zone 'Asia/Kolkata')::date)::date::text as "current"
  `) as Row[];
  if (isoDate(periodRow?.start) < isoDate(periodRow?.current)) {
    throw new ApiError("INVALID_FIELD", "Cannot set a target for a past period.", 422);
  }

  const [target] = (await sql`
    /* upsert_se_target */
    insert into se_targets (user_id, period_type, period_start, created_by)
    values (
      ${targetUserId}::uuid,
      ${input.periodType},
      date_trunc(${input.periodType}, coalesce(${input.periodDate}::date, (now() at time zone 'Asia/Kolkata')::date))::date,
      ${context.userId}::uuid
    )
    on conflict (user_id, period_type, period_start) do update set
      created_by = excluded.created_by,
      updated_at = now()
    returning id, period_type as "periodType", period_start as "periodStart"
  `) as Row[];

  const targetId = str(target.id);
  // Set all 7 segments (missing → 0) so removing a target zeroes it out.
  const values = OIL_SEGMENTS.map((segment) => ({
    segment,
    litres: segmentMap.get(segment) ?? 0,
  }));
  await sql`
    /* upsert_segment_targets */
    insert into se_segment_targets (se_target_id, segment, target_litres)
    select ${targetId}::uuid, v->>'segment', (v->>'litres')::numeric
    from jsonb_array_elements(${JSON.stringify(values)}::jsonb) v
    on conflict (se_target_id, segment) do update set
      target_litres = excluded.target_litres
  `;

  return {
    userId: targetUserId,
    seName: str(user.name),
    periodType: str(target.periodType),
    periodStart: isoDate(target.periodStart),
    segments: fillSegments(segmentMap),
  };
}
