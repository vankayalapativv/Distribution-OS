import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

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

/**
 * Collection-dues ageing (decided 2026-07-24): a customer with any invoice
 * outstanding sits in exactly ONE bucket, decided by the age (in days, IST,
 * counted from the invoice date) of their OLDEST invoice that still has
 * outstanding > 0. Buckets: 0–30 / 31–45 / 46–60 / 61+.
 */
export const DUES_BUCKETS = ["0_30", "30_45", "45_60", "60_plus"] as const;
export type DuesBucket = (typeof DUES_BUCKETS)[number];

export const DUES_BUCKET_LABELS: Record<DuesBucket, string> = {
  "0_30": "0–30 days",
  "30_45": "31–45 days",
  "45_60": "46–60 days",
  "60_plus": "61+ days",
};

/**
 * Ageing bucket for the oldest-outstanding-invoice age in days (IST). Mirrors the
 * SQL `case` used in the dues summaries. `null` age (nothing outstanding) → null.
 */
export function bucketFromAge(ageDays: number | null): DuesBucket | null {
  if (ageDays === null || !Number.isFinite(ageDays) || ageDays < 0) return null;
  if (ageDays <= 30) return "0_30";
  if (ageDays <= 45) return "30_45";
  if (ageDays <= 60) return "45_60";
  return "60_plus";
}

/** Bucket counts for the SE's own customers (customers.created_by = SE). */
export async function getMyDuesSummary(sql: SqlClient, context: { userId: string }) {
  const rows = await sql`
    /* dues_summary_for_se */
    with dues as (
      select
        i.customer_id,
        ((now() at time zone 'Asia/Kolkata')::date - min(i.invoice_date)) as age_days,
        sum(i.outstanding_amount) as outstanding
      from (
        select customer_id, invoice_date, outstanding_amount from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as invoice_date, outstanding_amount from customer_opening_balances where outstanding_amount > 0
      ) i
      join customers c on c.id = i.customer_id
      where c.created_by = ${context.userId}::uuid
      group by i.customer_id
    )
    select
      (case
        when age_days <= 30 then 0
        when age_days <= 45 then 1
        when age_days <= 60 then 2
        else 3
      end) as "bucket",
      count(*)::int as "customers",
      sum(outstanding) as "outstanding"
    from dues
    group by 1
  ` as Row[];

  const buckets = DUES_BUCKETS.map((key, index) => {
    const row = rows.find((r) => num(r.bucket) === index);
    return {
      key,
      label: DUES_BUCKET_LABELS[key],
      customers: row ? num(row.customers) : 0,
      outstanding: row ? num(row.outstanding) : 0,
    };
  });

  return {
    buckets,
    totalCustomers: buckets.reduce((acc, b) => acc + b.customers, 0),
    totalOutstanding: buckets.reduce((acc, b) => acc + b.outstanding, 0),
  };
}

/** Customers inside one bucket for the SE (drill-down list). */
export async function listMyDuesCustomers(
  sql: SqlClient,
  context: { userId: string },
  bucket: DuesBucket,
) {
  const index = DUES_BUCKETS.indexOf(bucket);
  if (index < 0) throw new ApiError("VALIDATION", "Unknown dues bucket.", 422);

  const rows = await sql`
    /* dues_customers_for_se */
    with dues as (
      select
        i.customer_id,
        min(i.invoice_date) as oldest_invoice_date,
        ((now() at time zone 'Asia/Kolkata')::date - min(i.invoice_date)) as age_days,
        sum(i.outstanding_amount) as outstanding
      from (
        select customer_id, invoice_date, outstanding_amount from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as invoice_date, outstanding_amount from customer_opening_balances where outstanding_amount > 0
      ) i
      join customers c on c.id = i.customer_id
      where c.created_by = ${context.userId}::uuid
      group by i.customer_id
    )
    select
      d.customer_id as "customerId",
      c.legal_name as "customerName",
      d.oldest_invoice_date as "oldestInvoiceDate",
      d.age_days as "ageDays",
      d.outstanding
    from dues d
    join customers c on c.id = d.customer_id
    where (case
      when d.age_days <= 30 then 0
      when d.age_days <= 45 then 1
      when d.age_days <= 60 then 2
      else 3
    end) = ${index}
    order by d.age_days desc, d.outstanding desc
  ` as Row[];

  return rows.map((r) => ({
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    oldestInvoiceDate: str(r.oldestInvoiceDate).slice(0, 10),
    ageDays: num(r.ageDays),
    outstanding: num(r.outstanding),
  }));
}

/**
 * MASTER dues summary (Super Admin / Manager web card) — TRUE invoice-level
 * ageing (2026-10-03): each unpaid invoice / opening balance is aged by ITS OWN
 * date and its FIFO-adjusted remaining (`outstanding_amount`, maintained by the
 * reconcile-recompute engine) is summed into that age band. So a customer with
 * a 70-day and a 5-day invoice contributes to BOTH 61+ and 0–30, not just their
 * oldest bucket. A customer can therefore appear in several buckets: each
 * bucket's `customers` is the DISTINCT count of customers with an item in that
 * band (bucket counts overlap and sum to MORE than `totalCustomers`), while
 * `totalCustomers` is the distinct count of all owers. `totalOutstanding` is
 * unchanged (Σ remaining = the gross debt) — only the distribution is truthful.
 * Optional executive/city filter. (SE mobile + maps keep the oldest-bucket rule.)
 */
export async function getAdminDuesSummary(
  sql: SqlClient,
  context: { executiveId?: string | null; city?: string | null } = {},
) {
  const executiveId = context.executiveId ?? null;
  const city = context.city ?? null;
  const rows = (await sql`
    /* dues_summary_admin */
    with items as (
      select
        i.customer_id,
        (case when i.age_days <= 30 then 0 when i.age_days <= 45 then 1 when i.age_days <= 60 then 2 else 3 end) as bucket,
        i.outstanding
      from (
        select customer_id, ((now() at time zone 'Asia/Kolkata')::date - invoice_date) as age_days, outstanding_amount as outstanding
          from invoices where outstanding_amount > 0
        union all
        select customer_id, ((now() at time zone 'Asia/Kolkata')::date - as_of_date) as age_days, outstanding_amount
          from customer_opening_balances where outstanding_amount > 0
      ) i
      join customers c on c.id = i.customer_id
      where (${executiveId}::uuid is null or c.created_by = ${executiveId}::uuid)
        and (${city}::text is null or c.address_city = ${city})
    )
    select
      grouping(bucket) as "isTotal",
      bucket,
      count(distinct customer_id)::int as "customers",
      coalesce(sum(outstanding), 0) as "outstanding"
    from items
    group by grouping sets ((bucket), ())
  `) as Row[];

  const totalRow = rows.find((r) => num(r.isTotal) === 1);
  const buckets = DUES_BUCKETS.map((key, index) => {
    const row = rows.find((r) => num(r.isTotal) === 0 && num(r.bucket) === index);
    return {
      key,
      label: DUES_BUCKET_LABELS[key],
      customers: row ? num(row.customers) : 0,
      outstanding: row ? num(row.outstanding) : 0,
    };
  });
  return {
    buckets,
    totalCustomers: totalRow ? num(totalRow.customers) : 0,
    totalOutstanding: totalRow ? num(totalRow.outstanding) : 0,
  };
}

export interface DuesByExecutiveRow {
  executiveId: string;
  executiveName: string;
  customerCount: number;
  totalOutstanding: number;
}

/**
 * Total collection-dues per sales executive (Super Admin Home): each ACTIVE SE
 * WITH dues, showing the sum of outstanding across the customers they own
 * (customers.created_by) and how many of those customers owe, ranked highest
 * first. SEs carrying no dues are omitted. Same source as the bucket views and
 * the master Collection-dues card — invoices + opening balances with
 * outstanding > 0 (so it reconciles with them, unlike the web KPI leaderboard
 * whose per-SE "Outstanding" counts invoices only, no opening balances).
 */
export async function getDuesByExecutive(sql: SqlClient): Promise<DuesByExecutiveRow[]> {
  const rows = (await sql`
    /* dues_by_executive */
    with per_customer as (
      select c.created_by as se_id, i.customer_id, sum(i.outstanding_amount) as outstanding
      from (
        select customer_id, outstanding_amount from invoices where outstanding_amount > 0
        union all
        select customer_id, outstanding_amount from customer_opening_balances where outstanding_amount > 0
      ) i
      join customers c on c.id = i.customer_id
      group by c.created_by, i.customer_id
    ),
    per_se as (
      select se_id, count(*)::int as customer_count, sum(outstanding) as total_outstanding
      from per_customer
      group by se_id
    )
    select
      u.id as "executiveId",
      u.name as "executiveName",
      p.customer_count as "customerCount",
      p.total_outstanding as "totalOutstanding"
    from per_se p
    join users u on u.id = p.se_id
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE'
      and u.status = 'active'
      and p.total_outstanding > 0
    order by "totalOutstanding" desc, u.name
  `) as Row[];

  return rows.map((r) => ({
    executiveId: str(r.executiveId),
    executiveName: str(r.executiveName),
    customerCount: num(r.customerCount),
    totalOutstanding: num(r.totalOutstanding),
  }));
}

/** MASTER bucket drill-down (Super Admin / Manager) — TRUE invoice-level
 *  (2026-10-03): one row per customer who has an unpaid invoice/opening balance
 *  in THIS age band, showing `bandOutstanding` (their remaining aged into this
 *  band — the rows sum to the bucket's total) plus `totalOutstanding` (their
 *  whole balance, for context). `bandOldestDate`/`bandAgeDays` are the oldest
 *  item within this band. Optional SE/city filter; tagged with the owning SE. */
export async function listAdminDuesCustomers(
  sql: SqlClient,
  bucket: DuesBucket,
  context: { executiveId?: string | null; city?: string | null } = {},
) {
  const index = DUES_BUCKETS.indexOf(bucket);
  if (index < 0) throw new ApiError("VALIDATION", "Unknown dues bucket.", 422);
  const executiveId = context.executiveId ?? null;
  const city = context.city ?? null;

  const rows = (await sql`
    /* dues_customers_admin */
    with items as (
      select
        i.customer_id,
        (case when i.age_days <= 30 then 0 when i.age_days <= 45 then 1 when i.age_days <= 60 then 2 else 3 end) as bucket,
        i.item_date,
        i.outstanding
      from (
        select customer_id, invoice_date as item_date, ((now() at time zone 'Asia/Kolkata')::date - invoice_date) as age_days, outstanding_amount as outstanding
          from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as item_date, ((now() at time zone 'Asia/Kolkata')::date - as_of_date) as age_days, outstanding_amount
          from customer_opening_balances where outstanding_amount > 0
      ) i
      join customers c on c.id = i.customer_id
      where (${executiveId}::uuid is null or c.created_by = ${executiveId}::uuid)
        and (${city}::text is null or c.address_city = ${city})
    ),
    per_customer as (
      select
        customer_id,
        sum(outstanding) filter (where bucket = ${index}) as band_outstanding,
        sum(outstanding) as total_outstanding,
        min(item_date) filter (where bucket = ${index}) as band_oldest_date
      from items
      group by customer_id
    )
    select
      pc.customer_id as "customerId",
      c.legal_name as "customerName",
      c.address_city as "city",
      se.name as "executiveName",
      pc.band_oldest_date as "bandOldestDate",
      ((now() at time zone 'Asia/Kolkata')::date - pc.band_oldest_date) as "bandAgeDays",
      pc.band_outstanding as "bandOutstanding",
      pc.total_outstanding as "totalOutstanding"
    from per_customer pc
    join customers c on c.id = pc.customer_id
    left join users se on se.id = c.created_by
    where pc.band_outstanding > 0
    order by pc.band_outstanding desc
  `) as Row[];

  return rows.map((r) => {
    const bandOldestDate = str(r.bandOldestDate).slice(0, 10);
    const bandAgeDays = num(r.bandAgeDays);
    const bandOutstanding = num(r.bandOutstanding);
    return {
      customerId: str(r.customerId),
      customerName: str(r.customerName),
      city: str(r.city),
      executiveName: str(r.executiveName),
      bandOldestDate,
      bandAgeDays,
      bandOutstanding,
      totalOutstanding: num(r.totalOutstanding),
      // Legacy aliases: the mobile admin screen reads these names. Kept alongside
      // the band* fields (the web reads those) so OLD app versions render the
      // per-band amount/age instead of ₹NaN — no mobile deploy needed.
      oldestInvoiceDate: bandOldestDate,
      ageDays: bandAgeDays,
      outstanding: bandOutstanding,
    };
  });
}

export interface DuesMaintenanceOptions {
  now?: string;
  /** IST hour (0–23) after which the daily run may fire. Default 9. */
  runAfterHour?: number;
}

export interface DuesCrossingPush {
  tokens: string[];
  title: string;
  body: string;
}

export interface DuesMaintenanceResult {
  ran: boolean;
  crossings: number;
  pushes: DuesCrossingPush[];
}

/**
 * Daily bucket-crossing check (called from the 3-minute cron; self-gates to
 * once per IST day after `runAfterHour` via the system_settings marker).
 *
 * - First sight of a customer with dues seeds state silently (no flood).
 * - An UPWARD move (new bucket > stored bucket) notifies the customer's SE
 *   (se_notifications row, type 'dues_bucket') and returns Expo push targets.
 * - Downward moves update silently; cleared dues delete the state row.
 */
export async function runDuesMaintenance(
  sql: SqlClient,
  options: DuesMaintenanceOptions = {},
): Promise<DuesMaintenanceResult> {
  const now = options.now ?? new Date().toISOString();
  const runAfterHour = options.runAfterHour ?? 9;

  const [gate] = await sql`
    /* dues_daily_gate */
    with ist as (
      select
        (${now}::timestamptz at time zone 'Asia/Kolkata')::date::text as today,
        extract(hour from ${now}::timestamptz at time zone 'Asia/Kolkata')::int as hour
    ),
    claimed as (
      insert into system_flags (key, value)
      select 'dues_last_run_date', ist.today from ist
      where ist.hour >= ${runAfterHour}
      on conflict (key) do update
        set value = excluded.value, updated_at = now()
        where system_flags.value <> excluded.value
      returning key
    )
    select exists (select 1 from claimed) as "claimed"
  ` as Row[];
  if (gate?.claimed !== true) return { ran: false, crossings: 0, pushes: [] };

  // Current truth for every customer with outstanding, plus stored state + SE.
  const rows = await sql`
    /* dues_compute_all */
    with dues as (
      select
        i.customer_id,
        min(i.invoice_date) as oldest_invoice_date,
        ((${now}::timestamptz at time zone 'Asia/Kolkata')::date - min(i.invoice_date)) as age_days,
        sum(i.outstanding_amount) as outstanding
      from (
        select customer_id, invoice_date, outstanding_amount from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as invoice_date, outstanding_amount from customer_opening_balances where outstanding_amount > 0
      ) i
      group by i.customer_id
    )
    select
      d.customer_id as "customerId",
      c.legal_name as "customerName",
      d.oldest_invoice_date as "oldestInvoiceDate",
      d.age_days as "ageDays",
      d.outstanding,
      (case
        when d.age_days <= 30 then 0
        when d.age_days <= 45 then 1
        when d.age_days <= 60 then 2
        else 3
      end) as "newBucket",
      s.bucket as "oldBucket",
      se.id as "seId"
    from dues d
    join customers c on c.id = d.customer_id
    left join customer_dues_state s on s.customer_id = d.customer_id
    left join users se
      on se.id = c.created_by
      and exists (
        select 1 from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = se.id and r.code = 'SALES_EXECUTIVE'
      )
  ` as Row[];

  const crossings = rows.filter(
    (r) =>
      r.oldBucket !== null &&
      r.oldBucket !== undefined &&
      num(r.newBucket) > num(r.oldBucket) &&
      str(r.seId).length > 0,
  );

  // Feed entries for every crossing, one set-based insert.
  if (crossings.length > 0) {
    const values = crossings.map((r) => {
      const bucketKey = DUES_BUCKETS[num(r.newBucket)];
      return {
        seId: str(r.seId),
        customerId: str(r.customerId),
        title: `Dues alert: ${str(r.customerName)}`,
        body: `${str(r.customerName)} moved into the ${DUES_BUCKET_LABELS[bucketKey]} bucket — ₹${num(r.outstanding).toLocaleString("en-IN")} outstanding since ${str(r.oldestInvoiceDate).slice(0, 10)}.`,
      };
    });
    await sql`
      /* dues_crossing_notifications */
      insert into se_notifications (user_id, type, title, body, customer_id)
      select (v->>'seId')::uuid, 'dues_bucket', v->>'title', v->>'body', (v->>'customerId')::uuid
      from jsonb_array_elements(${JSON.stringify(values)}::jsonb) as v
    `;
  }

  // Upsert state for everyone with dues; drop rows whose dues cleared.
  await sql`
    /* dues_state_upsert */
    with dues as (
      select
        i.customer_id,
        min(i.invoice_date) as oldest_invoice_date,
        ((${now}::timestamptz at time zone 'Asia/Kolkata')::date - min(i.invoice_date)) as age_days,
        sum(i.outstanding_amount) as outstanding
      from (
        select customer_id, invoice_date, outstanding_amount from invoices where outstanding_amount > 0
        union all
        select customer_id, as_of_date as invoice_date, outstanding_amount from customer_opening_balances where outstanding_amount > 0
      ) i
      group by i.customer_id
    )
    insert into customer_dues_state (customer_id, bucket, oldest_invoice_date, outstanding)
    select
      customer_id,
      (case
        when age_days <= 30 then 0
        when age_days <= 45 then 1
        when age_days <= 60 then 2
        else 3
      end)::smallint,
      oldest_invoice_date,
      outstanding
    from dues
    on conflict (customer_id) do update set
      bucket = excluded.bucket,
      oldest_invoice_date = excluded.oldest_invoice_date,
      outstanding = excluded.outstanding,
      updated_at = now()
  `;
  await sql`
    /* dues_state_clear */
    delete from customer_dues_state s
    where not exists (
      select 1 from invoices i
      where i.customer_id = s.customer_id and i.outstanding_amount > 0
    )
    and not exists (
      select 1 from customer_opening_balances ob
      where ob.customer_id = s.customer_id and ob.outstanding_amount > 0
    )
  `;

  // Push targets, grouped per SE crossing (one push per crossing customer).
  let pushes: DuesCrossingPush[] = [];
  if (crossings.length > 0) {
    const seIds = Array.from(new Set(crossings.map((r) => str(r.seId))));
    const tokenRows = await sql`
      /* dues_push_tokens */
      select user_id as "userId", token
      from push_tokens
      where user_id = any(${seIds}::uuid[])
    ` as Row[];
    const tokensBySe = new Map<string, string[]>();
    for (const t of tokenRows) {
      const list = tokensBySe.get(str(t.userId)) ?? [];
      list.push(str(t.token));
      tokensBySe.set(str(t.userId), list);
    }
    pushes = crossings
      .map((r) => {
        const bucketKey = DUES_BUCKETS[num(r.newBucket)];
        return {
          tokens: tokensBySe.get(str(r.seId)) ?? [],
          title: `Dues alert: ${str(r.customerName)}`,
          body: `Now in the ${DUES_BUCKET_LABELS[bucketKey]} bucket — ₹${num(r.outstanding).toLocaleString("en-IN")} outstanding.`,
        };
      })
      .filter((p) => p.tokens.length > 0);
  }

  return { ran: true, crossings: crossings.length, pushes };
}
