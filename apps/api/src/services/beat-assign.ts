import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

/**
 * Move a customer onto a weekday's beat (1=Mon…6=Sat). Each customer sits on
 * exactly one weekday (customer_id PK), so this upsert re-homes them, appending
 * to the end of the target day. The customer must be owned by a Sales Executive.
 */
export async function assignCustomerToDay(sql: SqlClient, customerId: string, weekday: number) {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) {
    throw new ApiError("INVALID_FIELD", "weekday must be a whole number 1–6 (Mon–Sat).", 422);
  }
  const [owner] = (await sql`
    /* beat_assign_owner */
    select c.created_by as "executiveId", r.code as "role"
    from customers c
    left join user_roles ur on ur.user_id = c.created_by
    left join roles r on r.id = ur.role_id
    where c.id = ${customerId}::uuid
    limit 1
  `) as Row[];
  const executiveId = str(owner?.executiveId);
  if (!executiveId || str(owner?.role) !== "SALES_EXECUTIVE") {
    throw new ApiError(
      "INVALID_REQUEST",
      "This customer has no sales executive owner, so it can't be placed on a beat.",
      422,
    );
  }
  await sql`
    /* assign_customer_to_beat_day */
    insert into beat_customer_days (customer_id, executive_id, weekday, sequence_no)
    values (
      ${customerId}::uuid, ${executiveId}::uuid, ${weekday},
      (select coalesce(max(sequence_no), 0) + 1 from beat_customer_days
       where executive_id = ${executiveId}::uuid and weekday = ${weekday})
    )
    on conflict (customer_id) do update
      set weekday = excluded.weekday, sequence_no = excluded.sequence_no, updated_at = now()
  `;
  return { customerId, weekday };
}

/**
 * Set the exact membership + visit order of one weekday for an executive, in a
 * single set-based upsert. `customerIds` is the ordered list of stops for that
 * day (index → sequence_no). Because beat_customer_days is keyed by customer_id,
 * this also handles a drag from another day / the pool: any listed customer's
 * row flips to this weekday, leaving its previous day automatically. Only the
 * executive's own customers are touched (a guard against cross-SE writes).
 */
export async function reorderBeatDay(
  sql: SqlClient,
  executiveId: string,
  weekday: number,
  customerIds: string[],
) {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) {
    throw new ApiError("INVALID_FIELD", "weekday must be a whole number 1–6 (Mon–Sat).", 422);
  }
  if (customerIds.length === 0) return { weekday, count: 0 };
  await sql`
    /* reorder_beat_day */
    insert into beat_customer_days (customer_id, executive_id, weekday, sequence_no)
    select x.cid, c.created_by, ${weekday}::int, x.ord::int
    from unnest(${customerIds}::uuid[]) with ordinality as x(cid, ord)
    join customers c on c.id = x.cid and c.created_by = ${executiveId}::uuid
    on conflict (customer_id) do update
      set weekday = excluded.weekday, sequence_no = excluded.sequence_no, updated_at = now()
  `;
  return { weekday, count: customerIds.length };
}

/** Remove a customer from every beat (the "Unassigned" bucket). */
export async function unassignCustomer(sql: SqlClient, customerId: string) {
  await sql`
    /* unassign_customer_beat */
    delete from beat_customer_days where customer_id = ${customerId}::uuid
  `;
  return { customerId };
}

/**
 * Auto-enroll a field-created customer into the executive's beat for the weekday
 * they were created on (Sunday → Monday, since Sunday has no beat). Never
 * overrides an existing assignment.
 */
export async function enrollCustomerInTodayBeat(
  sql: SqlClient,
  executiveId: string,
  customerId: string,
) {
  const [row] = (await sql`
    /* enroll_weekday_ist */
    select case
             when extract(isodow from (now() at time zone 'Asia/Kolkata'))::int = 7 then 1
             else extract(isodow from (now() at time zone 'Asia/Kolkata'))::int
           end as "weekday"
  `) as Row[];
  const weekday = num(row?.weekday) || 1;
  await sql`
    /* enroll_customer_today_beat */
    insert into beat_customer_days (customer_id, executive_id, weekday, sequence_no)
    values (
      ${customerId}::uuid, ${executiveId}::uuid, ${weekday},
      (select coalesce(max(sequence_no), 0) + 1 from beat_customer_days
       where executive_id = ${executiveId}::uuid and weekday = ${weekday})
    )
    on conflict (customer_id) do nothing
  `;
}
