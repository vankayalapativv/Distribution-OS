import type { SqlClient } from "../lib/db";

/**
 * Ensure today's beat_plans row and its stops exist, mirroring the executive's
 * weekday template (beat_customer_days). Idempotent — safe to call on every
 * GET /beats/today. Returns the plan id.
 *
 * Additions to the template propagate to today; a customer removed from the
 * template is dropped from today's plan ONLY if the SE hasn't checked in there
 * yet (a 'pending' stop) — checked-in / completed stops are preserved.
 */
export async function materializeTodayPlan(
  sql: SqlClient,
  executiveId: string,
  istDate: string,
  weekday: number,
): Promise<string> {
  await sql`
    /* upsert_today_beat_plan */
    insert into beat_plans (plan_date, executive_id, plan_status)
    values (${istDate}::date, ${executiveId}::uuid, 'planned')
    on conflict (executive_id, plan_date) do nothing
  `;
  const [plan] = await sql`
    /* today_beat_plan_id */
    select id from beat_plans
    where executive_id = ${executiveId}::uuid and plan_date = ${istDate}::date
    limit 1
  `;
  const planId = String(plan?.id ?? "");

  await sql`
    /* add_beat_stops_from_template */
    insert into beat_plan_stops (beat_plan_id, customer_id, sequence_no, stop_status)
    select ${planId}::uuid, bcd.customer_id, bcd.sequence_no, 'pending'
    from beat_customer_days bcd
    -- Only active customers become stops; the template row is kept so a customer
    -- reactivated later automatically reappears on the next day's plan.
    join customers c on c.id = bcd.customer_id and c.status = 'active'
    where bcd.executive_id = ${executiveId}::uuid and bcd.weekday = ${weekday}
    on conflict (beat_plan_id, customer_id) do nothing
  `;

  await sql`
    /* prune_beat_stops_removed_or_inactive */
    delete from beat_plan_stops s
    where s.beat_plan_id = ${planId}::uuid
      and s.stop_status = 'pending'
      and (
        -- removed from the SE's weekly template …
        not exists (
          select 1 from beat_customer_days bcd
          where bcd.executive_id = ${executiveId}::uuid
            and bcd.weekday = ${weekday}
            and bcd.customer_id = s.customer_id
        )
        -- … or the customer is no longer active (visited stops are kept as history).
        or exists (
          select 1 from customers c where c.id = s.customer_id and c.status <> 'active'
        )
      )
  `;
  return planId;
}
