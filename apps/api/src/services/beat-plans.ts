import type { SqlClient } from "../lib/db";

type Row = Record<string, unknown>;

const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};
const strOrNull = (v: unknown): string | null => str(v) || null;
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

/** Active Sales Executives — the picker on the Beat Plans config page. */
export async function listBeatExecutives(sql: SqlClient) {
  const rows = (await sql`
    /* beat_executives */
    select u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name) }));
}

/**
 * One executive's weekly beat template: every customer they own, each with its
 * assigned weekday (1=Mon…6=Sat) or null when unassigned. The web board groups
 * these into Mon–Sat columns plus an "Unassigned" bucket.
 */
export async function getBeatTemplate(sql: SqlClient, executiveId: string) {
  const rows = (await sql`
    /* beat_template */
    select
      c.id            as "customerId",
      c.customer_code as "customerCode",
      c.legal_name    as "legalName",
      c.trade_name    as "tradeName",
      c.phone         as "phone",
      c.address_city  as "city",
      c.segment       as "segment",
      bcd.weekday     as "weekday",
      bcd.sequence_no as "sequenceNo"
    from customers c
    left join beat_customer_days bcd on bcd.customer_id = c.id
    where c.created_by = ${executiveId}::uuid
      and c.status = 'active'
    order by bcd.weekday nulls last, bcd.sequence_no, c.legal_name
  `) as Row[];
  return rows.map((r) => ({
    customerId: str(r.customerId),
    customerCode: str(r.customerCode),
    legalName: str(r.legalName),
    tradeName: strOrNull(r.tradeName),
    phone: strOrNull(r.phone),
    city: strOrNull(r.city),
    segment: strOrNull(r.segment),
    weekday: r.weekday == null ? null : num(r.weekday),
    sequenceNo: num(r.sequenceNo),
  }));
}
