import type { SqlClient } from "../lib/db";
import { materializeTodayPlan } from "./beat-materialize";
import { bucketFromAge } from "./dues";

interface BeatsContext {
  userId: string;
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

function mapStopRow(row: Row) {
  // Collection due for this exact customer: total outstanding + the ageing bucket
  // of their oldest unpaid invoice (null bucket when nothing is due).
  const outstanding = num(row.outstanding);
  return {
    stopId: str(row.stopId),
    sequenceNo: typeof row.sequenceNo === "number" ? row.sequenceNo : Number(row.sequenceNo ?? 0),
    stopStatus: str(row.stopStatus),
    customerId: str(row.customerId),
    customerCode: str(row.customerCode),
    legalName: str(row.legalName),
    contactPhone: strOrNull(row.contactPhone),
    address: strOrNull(row.address),
    city: strOrNull(row.city),
    outstanding,
    dueBucket: outstanding > 0 ? bucketFromAge(num(row.ageDays)) : null,
  };
}

export async function getTodayBeatPlan(sql: SqlClient, context: BeatsContext) {
  // "Today" is the IST calendar day; the weekday drives which template applies.
  const [today] = await sql`
    /* beat_today_ist */
    select
      extract(isodow from (now() at time zone 'Asia/Kolkata'))::int as "weekday",
      (now() at time zone 'Asia/Kolkata')::date as "istDate"
  `;
  const weekday = typeof today?.weekday === "number" ? today.weekday : Number(today?.weekday ?? 0);
  const planDate = str(today?.istDate);

  // Sunday (isodow 7) has no beat.
  if (weekday < 1 || weekday > 6) {
    return { beatPlanId: null, planDate: planDate || null, planStatus: null, stops: [] };
  }

  const beatPlanId = await materializeTodayPlan(sql, context.userId, planDate, weekday);

  const stops = await sql`
    /* get_beat_plan_stops */
    select
      bps.id as "stopId",
      bps.sequence_no as "sequenceNo",
      bps.stop_status as "stopStatus",
      c.id as "customerId",
      c.customer_code as "customerCode",
      c.legal_name as "legalName",
      c.phone as "contactPhone",
      c.address_street as "address",
      c.address_city as "city",
      coalesce(due.outstanding, 0) as "outstanding",
      due.age_days as "ageDays"
    from beat_plan_stops bps
    join customers c on c.id = bps.customer_id
    -- This customer's collection due: total outstanding + oldest-unpaid age (IST),
    -- from invoices + opening balances (same ground truth as the Dues card).
    left join lateral (
      select
        sum(x.outstanding_amount) as outstanding,
        ((now() at time zone 'Asia/Kolkata')::date - min(x.invoice_date)) as age_days
      from (
        select invoice_date, outstanding_amount
          from invoices where customer_id = c.id and outstanding_amount > 0
        union all
        select as_of_date, outstanding_amount
          from customer_opening_balances where customer_id = c.id and outstanding_amount > 0
      ) x
    ) due on true
    where bps.beat_plan_id = ${beatPlanId}::uuid
      -- Never surface a deactivated/suspended customer on the SE's beat plan,
      -- even if a stop was materialized while they were still active.
      and c.status = 'active'
    order by bps.sequence_no
  `;

  return {
    beatPlanId,
    planDate,
    planStatus: "planned",
    stops: stops.map(mapStopRow),
  };
}
