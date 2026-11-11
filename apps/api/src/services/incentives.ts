import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

type Row = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const numOrNull = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};

/** One executive's monthly incentive row (actuals + inputs + computed amounts). */
export interface IncentiveRow {
  userId: string;
  name: string;
  /** Verified collections that month (collector-attributed, by approved month). */
  collectionsTotal: number;
  /** Oil litres sold that month (orders, net of returns). */
  litresTotal: number;
  // Manually-entered knobs (null when unset):
  collectionPct: number | null;
  perLitreRate: number | null;
  targetLitres: number | null;
  targetReward: number | null;
  // Computed payouts:
  collectionsIncentive: number;
  perLitreIncentive: number;
  targetMet: boolean;
  targetIncentive: number;
  totalIncentive: number;
}

export interface IncentivesResponse {
  period: { month: string; label: string; isCurrent: boolean };
  executives: IncentiveRow[];
}

/** Normalize a "YYYY-MM" (or "YYYY-MM-DD") to the first day of that IST month. */
function monthStart(month: string | null): string {
  const m = (month ?? "").trim();
  const match = /^(\d{4})-(\d{2})/.exec(m);
  if (!match) return "";
  return `${match[1]}-${match[2]}-01`;
}

/**
 * Every active SE's incentive for one month: live actuals (verified collections
 * + oil litres) joined with the stored knobs, plus the computed payouts (all
 * money math in SQL numeric).
 */
export async function listIncentives(sql: SqlClient, opts: { month: string | null }) {
  const start = monthStart(opts.month);
  if (!start) throw new ApiError("INVALID_FIELD", "month must be YYYY-MM.", 422);

  const rows = (await sql`
    /* incentives_list */
    with se as (
      select u.id, u.name
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    ),
    coll as (
      select collected_by_user_id as uid, coalesce(sum(collection_amount), 0) as total
      from collections
      where accountant_approval_status = 'verified'
        and approved_at is not null
        and date_trunc('month', (approved_at at time zone 'Asia/Kolkata'))::date = ${start}::date
      group by collected_by_user_id
    ),
    litres as (
      select o.sales_executive_id as uid,
             coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0) as litres
      from orders o
      join order_items oi on oi.order_id = o.id and oi.product_id is not null
      left join (
        select order_item_id, coalesce(sum(litres), 0) as rlitres
        from sales_return_items where kind = 'oil' group by order_item_id
      ) ret on ret.order_item_id = oi.id
      where o.order_status <> 'cancelled'
        and date_trunc('month', o.order_date)::date = ${start}::date
      group by o.sales_executive_id
    )
    select
      se.id                                              as "userId",
      se.name                                            as "name",
      coalesce(coll.total, 0)::numeric                   as "collectionsTotal",
      coalesce(litres.litres, 0)::numeric                as "litresTotal",
      inc.collection_pct                                 as "collectionPct",
      inc.per_litre_rate                                 as "perLitreRate",
      inc.target_litres                                  as "targetLitres",
      inc.target_reward                                  as "targetReward",
      (coalesce(coll.total, 0) * coalesce(inc.collection_pct, 0) / 100)::numeric   as "collectionsIncentive",
      (coalesce(litres.litres, 0) * coalesce(inc.per_litre_rate, 0))::numeric      as "perLitreIncentive",
      (inc.target_litres is not null and inc.target_litres > 0
        and coalesce(litres.litres, 0) >= inc.target_litres)                       as "targetMet",
      (case when inc.target_litres is not null and inc.target_litres > 0
             and coalesce(litres.litres, 0) >= inc.target_litres
            then coalesce(inc.target_reward, 0) else 0 end)::numeric               as "targetIncentive"
    from se
    left join coll   on coll.uid = se.id
    left join litres on litres.uid = se.id
    left join se_incentives inc on inc.user_id = se.id and inc.period_month = ${start}::date
    order by se.name
  `) as Row[];

  const executives: IncentiveRow[] = rows.map((r) => {
    const collectionsIncentive = num(r.collectionsIncentive);
    const perLitreIncentive = num(r.perLitreIncentive);
    const targetIncentive = num(r.targetIncentive);
    return {
      userId: str(r.userId),
      name: str(r.name),
      collectionsTotal: num(r.collectionsTotal),
      litresTotal: num(r.litresTotal),
      collectionPct: numOrNull(r.collectionPct),
      perLitreRate: numOrNull(r.perLitreRate),
      targetLitres: numOrNull(r.targetLitres),
      targetReward: numOrNull(r.targetReward),
      collectionsIncentive,
      perLitreIncentive,
      targetMet: r.targetMet === true,
      targetIncentive,
      totalIncentive: collectionsIncentive + perLitreIncentive + targetIncentive,
    };
  });

  const [meta] = (await sql`
    /* incentives_period_meta */
    select
      to_char(${start}::date, 'Mon YYYY') as "label",
      (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date = ${start}::date) as "isCurrent"
  `) as Row[];

  return {
    period: {
      month: start.slice(0, 7),
      label: str(meta?.label),
      isCurrent: meta?.isCurrent === true,
    },
    executives,
  } satisfies IncentivesResponse;
}

export interface IncentiveUpsertInput {
  month: string;
  collectionPct: number | null;
  perLitreRate: number | null;
  targetLitres: number | null;
  targetReward: number | null;
}

function assertNonNegative(value: number | null, label: string, max?: number) {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError("INVALID_FIELD", `${label} must be zero or positive.`, 422);
  }
  if (max != null && value > max) {
    throw new ApiError("INVALID_FIELD", `${label} must be at most ${max}.`, 422);
  }
}

/** Upsert one SE's incentive knobs for a month. */
export async function upsertIncentive(
  sql: SqlClient,
  context: { userId: string },
  targetUserId: string,
  input: IncentiveUpsertInput,
) {
  const start = monthStart(input.month);
  if (!start) throw new ApiError("INVALID_FIELD", "month must be YYYY-MM.", 422);
  assertNonNegative(input.collectionPct, "Collection %", 100);
  assertNonNegative(input.perLitreRate, "Per-litre rate");
  assertNonNegative(input.targetLitres, "Target litres");
  assertNonNegative(input.targetReward, "Target reward");

  const [user] = (await sql`
    /* incentive_user_exists */
    select u.id from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${targetUserId}::uuid and r.code = 'SALES_EXECUTIVE'
    limit 1
  `) as Row[];
  if (!user) throw new ApiError("NOT_FOUND", "Sales executive not found.", 404);

  await sql`
    /* upsert_se_incentive */
    insert into se_incentives
      (user_id, period_month, collection_pct, per_litre_rate, target_litres, target_reward, updated_by, updated_at)
    values (
      ${targetUserId}::uuid, ${start}::date,
      ${input.collectionPct}, ${input.perLitreRate}, ${input.targetLitres}, ${input.targetReward},
      ${context.userId}::uuid, now()
    )
    on conflict (user_id, period_month) do update set
      collection_pct = excluded.collection_pct,
      per_litre_rate = excluded.per_litre_rate,
      target_litres  = excluded.target_litres,
      target_reward  = excluded.target_reward,
      updated_by     = excluded.updated_by,
      updated_at     = now()
  `;

  return { ok: true };
}
