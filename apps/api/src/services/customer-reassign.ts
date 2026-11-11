import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

// Customer reassignment (SUPER_ADMIN moves a customer's full ownership from one
// Sales Executive to another). Per-customer only — there is NO bulk path.
//
// Ownership is `customers.created_by`; the move also rewrites every business
// record currently attributed to the FROM owner (orders, collections, invoices,
// visits, photos, notes) plus the weekly beat template (beat_customer_days), and
// removes any still-pending stop on the old owner's TODAY plan so the 8 PM cron
// can't flag it 'missed'. GPS/tracking and logistics runs are deliberately left
// as-is (they record who was physically present).
//
// Each reassignment writes one `customer_reassignments` audit row whose `moved`
// jsonb records the exact ids (weekdays for the beat) that changed, so undo
// reverses ONLY those rows.

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

export interface ReassignContext {
  userId: string;
}

export interface MovedCounts {
  orders: number;
  collections: number;
  invoices: number;
  visits: number;
  photos: number;
  notes: number;
  beatDays: number;
}

export interface ReassignHistoryEntry {
  id: string;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  assignedByName: string | null;
  createdAt: string;
  undoneAt: string | null;
  counts: MovedCounts;
}

export interface ReassignPreview {
  customer: { id: string; customerCode: string | null; legalName: string };
  currentOwner: { id: string; name: string } | null;
  counts: MovedCounts;
  /** The latest reassignment that can still be undone (null if none). */
  undoable: ReassignHistoryEntry | null;
  history: ReassignHistoryEntry[];
  salesExecutives: { id: string; name: string }[];
}

const ZERO_COUNTS: MovedCounts = {
  orders: 0,
  collections: 0,
  invoices: 0,
  visits: 0,
  photos: 0,
  notes: 0,
  beatDays: 0,
};

function mapCounts(v: unknown): MovedCounts {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    orders: num(o.orders),
    collections: num(o.collections),
    invoices: num(o.invoices),
    visits: num(o.visits),
    photos: num(o.photos),
    notes: num(o.notes),
    beatDays: num(o.beatDays),
  };
}

function mapHistory(row: Row): ReassignHistoryEntry {
  return {
    id: str(row.id),
    fromUserId: nullStr(row.fromUserId),
    fromUserName: nullStr(row.fromUserName),
    toUserId: nullStr(row.toUserId),
    toUserName: nullStr(row.toUserName),
    assignedByName: nullStr(row.assignedByName),
    createdAt: str(row.createdAt),
    undoneAt: row.undoneAt instanceof Date || typeof row.undoneAt === "string" ? str(row.undoneAt) : null,
    counts: mapCounts(row.counts),
  };
}

/** Active users holding the SALES_EXECUTIVE role — the reassignment targets. */
async function listSalesExecutives(sql: SqlClient) {
  const rows = (await sql`
    /* reassign_list_ses */
    select u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name) }));
}

/** Counts of records currently attributed to `ownerId` for this customer. */
async function countAttributed(sql: SqlClient, customerId: string, ownerId: string): Promise<MovedCounts> {
  const [row] = (await sql`
    /* reassign_counts */
    select
      (select count(*) from orders o
         where o.customer_id = ${customerId}::uuid
           and (o.sales_executive_id = ${ownerId}::uuid or o.created_by = ${ownerId}::uuid)) as orders,
      (select count(*) from collections col
         where col.customer_id = ${customerId}::uuid
           and (col.collected_by_user_id = ${ownerId}::uuid or col.created_by = ${ownerId}::uuid)) as collections,
      (select count(*) from invoices i
         where i.customer_id = ${customerId}::uuid
           and (i.sales_executive_id = ${ownerId}::uuid or i.created_by = ${ownerId}::uuid)) as invoices,
      (select count(*) from visits v
         where v.customer_id = ${customerId}::uuid and v.executive_id = ${ownerId}::uuid) as visits,
      (select count(*) from customer_photos p
         where p.customer_id = ${customerId}::uuid and p.uploaded_by = ${ownerId}::uuid) as photos,
      (select count(*) from customer_notes n
         where n.customer_id = ${customerId}::uuid
           and (n.created_by = ${ownerId}::uuid or n.edited_by = ${ownerId}::uuid)) as notes,
      (select count(*) from beat_customer_days b
         where b.customer_id = ${customerId}::uuid and b.executive_id = ${ownerId}::uuid) as "beatDays"
  `) as Row[];
  return mapCounts(row);
}

async function loadHistory(sql: SqlClient, customerId: string): Promise<ReassignHistoryEntry[]> {
  const rows = (await sql`
    /* reassign_history */
    select
      ra.id,
      ra.from_user_id as "fromUserId",
      fu.name as "fromUserName",
      ra.to_user_id as "toUserId",
      tu.name as "toUserName",
      au.name as "assignedByName",
      ra.created_at as "createdAt",
      ra.undone_at as "undoneAt",
      ra.moved_counts as "counts"
    from customer_reassignments ra
    left join users fu on fu.id = ra.from_user_id
    left join users tu on tu.id = ra.to_user_id
    left join users au on au.id = ra.assigned_by
    where ra.customer_id = ${customerId}::uuid
    order by ra.created_at desc
  `) as Row[];
  return rows.map(mapHistory);
}

/** Customer header + current owner, or throw 404. */
async function loadCustomerOwner(sql: SqlClient, customerId: string) {
  const [row] = (await sql`
    /* reassign_customer */
    select c.id, c.customer_code as "customerCode", c.legal_name as "legalName",
           c.created_by as "ownerId", ow.name as "ownerName"
    from customers c
    left join users ow on ow.id = c.created_by
    where c.id = ${customerId}::uuid
  `) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  return {
    customer: {
      id: str(row.id),
      customerCode: nullStr(row.customerCode),
      legalName: str(row.legalName),
    },
    ownerId: nullStr(row.ownerId),
    ownerName: nullStr(row.ownerName),
  };
}

export async function getReassignPreview(sql: SqlClient, customerId: string): Promise<ReassignPreview> {
  const { customer, ownerId, ownerName } = await loadCustomerOwner(sql, customerId);
  const [counts, history, salesExecutives] = await Promise.all([
    ownerId ? countAttributed(sql, customerId, ownerId) : Promise.resolve(ZERO_COUNTS),
    loadHistory(sql, customerId),
    listSalesExecutives(sql),
  ]);
  const undoable = history.find((h) => h.undoneAt === null) ?? null;
  return {
    customer,
    currentOwner: ownerId ? { id: ownerId, name: ownerName ?? "" } : null,
    counts,
    undoable,
    history,
    salesExecutives,
  };
}

/** Assert `userId` is an active SALES_EXECUTIVE, or throw 422. */
async function assertActiveSe(sql: SqlClient, userId: string, label: string) {
  const [row] = (await sql`
    /* reassign_assert_se */
    select 1 as ok
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${userId}::uuid and r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    limit 1
  `) as Row[];
  if (!row) throw new ApiError("VALIDATION", `${label} is not an active sales executive.`, 422);
}

export async function reassignCustomer(
  sql: SqlClient,
  context: ReassignContext,
  customerId: string,
  toUserId: string,
): Promise<ReassignHistoryEntry> {
  const { ownerId } = await loadCustomerOwner(sql, customerId);
  if (!ownerId) {
    throw new ApiError(
      "VALIDATION",
      "This customer has no current owner to reassign from. Assign a sales executive to it first.",
      422,
    );
  }
  if (ownerId === toUserId) {
    throw new ApiError("VALIDATION", "The customer is already owned by that sales executive.", 422);
  }
  await assertActiveSe(sql, toUserId, "The selected executive");

  // One atomic statement. Because two columns of the SAME table can both move
  // (orders.sales_executive_id + created_by; collections; invoices; notes), we
  // must NOT update the same row from two CTEs — Postgres applies only one. So:
  //   1. pre-select the id sets per (table,column) on the pre-update snapshot,
  //   2. update each table ONCE, moving each column via a CASE keyed on those sets,
  //   3. build the `moved` payload from the pre-selected sets.
  const [row] = (await sql`
    /* reassign_customer_apply */
    with
      s_ord_se as (select id from orders where customer_id = ${customerId}::uuid and sales_executive_id = ${ownerId}::uuid),
      s_ord_cb as (select id from orders where customer_id = ${customerId}::uuid and created_by = ${ownerId}::uuid),
      s_col_by as (select id from collections where customer_id = ${customerId}::uuid and collected_by_user_id = ${ownerId}::uuid),
      s_col_cb as (select id from collections where customer_id = ${customerId}::uuid and created_by = ${ownerId}::uuid),
      s_inv_se as (select id from invoices where customer_id = ${customerId}::uuid and sales_executive_id = ${ownerId}::uuid),
      s_inv_cb as (select id from invoices where customer_id = ${customerId}::uuid and created_by = ${ownerId}::uuid),
      s_vis as (select id from visits where customer_id = ${customerId}::uuid and executive_id = ${ownerId}::uuid),
      s_pho as (select id from customer_photos where customer_id = ${customerId}::uuid and uploaded_by = ${ownerId}::uuid),
      s_note_cb as (select id from customer_notes where customer_id = ${customerId}::uuid and created_by = ${ownerId}::uuid),
      s_note_eb as (select id from customer_notes where customer_id = ${customerId}::uuid and edited_by = ${ownerId}::uuid),
      s_beat as (select weekday from beat_customer_days where customer_id = ${customerId}::uuid and executive_id = ${ownerId}::uuid),
      s_cust_owned as (select 1 from customers where id = ${customerId}::uuid and created_by = ${ownerId}::uuid),
      u_cust as (
        update customers set created_by = ${toUserId}::uuid
        where id = ${customerId}::uuid and created_by = ${ownerId}::uuid
        returning id
      ),
      u_ord as (
        update orders o set
          sales_executive_id = case when o.id in (select id from s_ord_se) then ${toUserId}::uuid else o.sales_executive_id end,
          created_by         = case when o.id in (select id from s_ord_cb) then ${toUserId}::uuid else o.created_by end
        where o.id in (select id from s_ord_se) or o.id in (select id from s_ord_cb)
        returning o.id
      ),
      u_col as (
        update collections col set
          collected_by_user_id = case when col.id in (select id from s_col_by) then ${toUserId}::uuid else col.collected_by_user_id end,
          created_by           = case when col.id in (select id from s_col_cb) then ${toUserId}::uuid else col.created_by end
        where col.id in (select id from s_col_by) or col.id in (select id from s_col_cb)
        returning col.id
      ),
      u_inv as (
        update invoices i set
          sales_executive_id = case when i.id in (select id from s_inv_se) then ${toUserId}::uuid else i.sales_executive_id end,
          created_by         = case when i.id in (select id from s_inv_cb) then ${toUserId}::uuid else i.created_by end
        where i.id in (select id from s_inv_se) or i.id in (select id from s_inv_cb)
        returning i.id
      ),
      u_note as (
        update customer_notes n set
          created_by = case when n.id in (select id from s_note_cb) then ${toUserId}::uuid else n.created_by end,
          edited_by  = case when n.id in (select id from s_note_eb) then ${toUserId}::uuid else n.edited_by end
        where n.id in (select id from s_note_cb) or n.id in (select id from s_note_eb)
        returning n.id
      ),
      u_vis as (
        update visits set executive_id = ${toUserId}::uuid
        where customer_id = ${customerId}::uuid and executive_id = ${ownerId}::uuid
        returning id
      ),
      u_pho as (
        update customer_photos set uploaded_by = ${toUserId}::uuid
        where customer_id = ${customerId}::uuid and uploaded_by = ${ownerId}::uuid
        returning id
      ),
      u_beat as (
        update beat_customer_days set executive_id = ${toUserId}::uuid
        where customer_id = ${customerId}::uuid and executive_id = ${ownerId}::uuid
        returning weekday
      ),
      del_stops as (
        delete from beat_plan_stops bps
        using beat_plans bp
        where bps.beat_plan_id = bp.id
          and bp.executive_id = ${ownerId}::uuid
          and bp.plan_date = (now() at time zone 'Asia/Kolkata')::date
          and bps.customer_id = ${customerId}::uuid
          and bps.stop_status = 'pending'
        returning bps.id
      )
    insert into customer_reassignments
      (customer_id, from_user_id, to_user_id, assigned_by, moved, moved_counts)
    select
      ${customerId}::uuid, ${ownerId}::uuid, ${toUserId}::uuid, ${context.userId}::uuid,
      jsonb_build_object(
        'orders_sales_executive_id',        (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_ord_se),
        'orders_created_by',                (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_ord_cb),
        'collections_collected_by_user_id', (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_col_by),
        'collections_created_by',           (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_col_cb),
        'invoices_sales_executive_id',      (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_inv_se),
        'invoices_created_by',              (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_inv_cb),
        'visits_executive_id',              (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_vis),
        'customer_photos_uploaded_by',      (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_pho),
        'customer_notes_created_by',        (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_note_cb),
        'customer_notes_edited_by',         (select coalesce(jsonb_agg(id), '[]'::jsonb) from s_note_eb),
        'beat_customer_days_weekdays',      (select coalesce(jsonb_agg(weekday), '[]'::jsonb) from s_beat)
      ),
      jsonb_build_object(
        'orders',      (select count(*) from (select id from s_ord_se union select id from s_ord_cb) x),
        'collections', (select count(*) from (select id from s_col_by union select id from s_col_cb) x),
        'invoices',    (select count(*) from (select id from s_inv_se union select id from s_inv_cb) x),
        'visits',      (select count(*) from s_vis),
        'photos',      (select count(*) from s_pho),
        'notes',       (select count(*) from (select id from s_note_cb union select id from s_note_eb) x),
        'beatDays',    (select count(*) from s_beat)
      )
    where exists (select 1 from s_cust_owned)
    returning id
  `) as Row[];

  if (!row) {
    // Owner changed between read and write (extremely unlikely for a manual action).
    throw new ApiError("CONFLICT", "The customer's owner changed; reload and try again.", 409);
  }
  const [entry] = await loadHistoryById(sql, str(row.id));
  return entry;
}

async function loadHistoryById(sql: SqlClient, reassignId: string): Promise<ReassignHistoryEntry[]> {
  const rows = (await sql`
    /* reassign_history_by_id */
    select
      ra.id,
      ra.from_user_id as "fromUserId", fu.name as "fromUserName",
      ra.to_user_id as "toUserId", tu.name as "toUserName",
      au.name as "assignedByName",
      ra.created_at as "createdAt", ra.undone_at as "undoneAt",
      ra.moved_counts as "counts"
    from customer_reassignments ra
    left join users fu on fu.id = ra.from_user_id
    left join users tu on tu.id = ra.to_user_id
    left join users au on au.id = ra.assigned_by
    where ra.id = ${reassignId}::uuid
  `) as Row[];
  return rows.map(mapHistory);
}

/**
 * Reverse the latest not-yet-undone reassignment for this customer. Undo is
 * available "until superseded": only the most recent active reassignment can be
 * reversed. Reverses ONLY the rows this reassignment moved (from `moved`), so
 * anything the new owner did afterward stays with the new owner.
 */
export async function undoReassignment(
  sql: SqlClient,
  context: ReassignContext,
  customerId: string,
): Promise<ReassignHistoryEntry> {
  const [target] = (await sql`
    /* reassign_undo_find */
    select id from customer_reassignments
    where customer_id = ${customerId}::uuid and undone_at is null
    order by created_at desc
    limit 1
  `) as Row[];
  if (!target) {
    throw new ApiError("CONFLICT", "There is no reassignment to undo for this customer.", 409);
  }
  const reassignId = str(target.id);

  const [row] = (await sql`
    /* reassign_undo_apply */
    with tgt as (
      select customer_id, from_user_id, to_user_id, moved
      from customer_reassignments
      where id = ${reassignId}::uuid and undone_at is null
    ),
    r_cust as (
      update customers set created_by = (select from_user_id from tgt)
      where id = (select customer_id from tgt)
        and created_by = (select to_user_id from tgt)
        and exists (select 1 from tgt)
      returning id
    ),
    r_ord as (
      update orders o set
        sales_executive_id = case
          when o.sales_executive_id = (select to_user_id from tgt)
           and o.id in (select (jsonb_array_elements_text(moved->'orders_sales_executive_id'))::uuid from tgt)
          then (select from_user_id from tgt) else o.sales_executive_id end,
        created_by = case
          when o.created_by = (select to_user_id from tgt)
           and o.id in (select (jsonb_array_elements_text(moved->'orders_created_by'))::uuid from tgt)
          then (select from_user_id from tgt) else o.created_by end
      where o.id in (select (jsonb_array_elements_text(moved->'orders_sales_executive_id'))::uuid from tgt)
         or o.id in (select (jsonb_array_elements_text(moved->'orders_created_by'))::uuid from tgt)
      returning o.id
    ),
    r_col as (
      update collections col set
        collected_by_user_id = case
          when col.collected_by_user_id = (select to_user_id from tgt)
           and col.id in (select (jsonb_array_elements_text(moved->'collections_collected_by_user_id'))::uuid from tgt)
          then (select from_user_id from tgt) else col.collected_by_user_id end,
        created_by = case
          when col.created_by = (select to_user_id from tgt)
           and col.id in (select (jsonb_array_elements_text(moved->'collections_created_by'))::uuid from tgt)
          then (select from_user_id from tgt) else col.created_by end
      where col.id in (select (jsonb_array_elements_text(moved->'collections_collected_by_user_id'))::uuid from tgt)
         or col.id in (select (jsonb_array_elements_text(moved->'collections_created_by'))::uuid from tgt)
      returning col.id
    ),
    r_inv as (
      update invoices i set
        sales_executive_id = case
          when i.sales_executive_id = (select to_user_id from tgt)
           and i.id in (select (jsonb_array_elements_text(moved->'invoices_sales_executive_id'))::uuid from tgt)
          then (select from_user_id from tgt) else i.sales_executive_id end,
        created_by = case
          when i.created_by = (select to_user_id from tgt)
           and i.id in (select (jsonb_array_elements_text(moved->'invoices_created_by'))::uuid from tgt)
          then (select from_user_id from tgt) else i.created_by end
      where i.id in (select (jsonb_array_elements_text(moved->'invoices_sales_executive_id'))::uuid from tgt)
         or i.id in (select (jsonb_array_elements_text(moved->'invoices_created_by'))::uuid from tgt)
      returning i.id
    ),
    r_note as (
      update customer_notes n set
        created_by = case
          when n.created_by = (select to_user_id from tgt)
           and n.id in (select (jsonb_array_elements_text(moved->'customer_notes_created_by'))::uuid from tgt)
          then (select from_user_id from tgt) else n.created_by end,
        edited_by = case
          when n.edited_by = (select to_user_id from tgt)
           and n.id in (select (jsonb_array_elements_text(moved->'customer_notes_edited_by'))::uuid from tgt)
          then (select from_user_id from tgt) else n.edited_by end
      where n.id in (select (jsonb_array_elements_text(moved->'customer_notes_created_by'))::uuid from tgt)
         or n.id in (select (jsonb_array_elements_text(moved->'customer_notes_edited_by'))::uuid from tgt)
      returning n.id
    ),
    r_vis as (
      update visits set executive_id = (select from_user_id from tgt)
      where executive_id = (select to_user_id from tgt)
        and id in (select (jsonb_array_elements_text(moved->'visits_executive_id'))::uuid from tgt)
      returning id
    ),
    r_pho as (
      update customer_photos set uploaded_by = (select from_user_id from tgt)
      where uploaded_by = (select to_user_id from tgt)
        and id in (select (jsonb_array_elements_text(moved->'customer_photos_uploaded_by'))::uuid from tgt)
      returning id
    ),
    r_beat as (
      update beat_customer_days set executive_id = (select from_user_id from tgt)
      where customer_id = (select customer_id from tgt)
        and executive_id = (select to_user_id from tgt)
        and weekday in (select (jsonb_array_elements_text(moved->'beat_customer_days_weekdays'))::int from tgt)
      returning weekday
    )
    update customer_reassignments
    set undone_at = now(), undone_by = ${context.userId}::uuid
    where id = ${reassignId}::uuid and undone_at is null
      and exists (select 1 from tgt)
    returning id
  `) as Row[];

  if (!row) {
    throw new ApiError("CONFLICT", "The reassignment was already undone.", 409);
  }
  const [entry] = await loadHistoryById(sql, reassignId);
  return entry;
}
