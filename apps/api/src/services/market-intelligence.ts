import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Neon returns date columns as JS Date objects.
function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === "string" ? v.slice(0, 10) : "";
}

export const NOTE_ITEM_CATEGORIES = new Set([
  "pricing",
  "promotion",
  "stock",
  "competitor_activity",
  "demand",
  "other",
]);

export interface NoteItemInput {
  category: string;
  competitorBrand?: string | null;
  product?: string | null;
  price?: number | null;
  details?: string | null;
}

interface NoteContext {
  userId: string;
}

function mapItem(r: Row) {
  return {
    id: str(r.id),
    category: str(r.category),
    competitorBrand: nullStr(r.competitorBrand),
    product: nullStr(r.product),
    price: num(r.price),
    details: str(r.details),
  };
}

function mapNote(r: Row) {
  return {
    id: str(r.id),
    meetingDate: dateStr(r.meetingDate),
    seUserId: str(r.seUserId),
    seName: nullStr(r.seName),
    customerId: nullStr(r.customerId),
    customerName: nullStr(r.customerName),
    note: str(r.note),
    createdBy: str(r.createdBy),
    createdByName: nullStr(r.createdByName),
    createdAt: str(r.createdAt),
  };
}

function assertValidItems(items: NoteItemInput[]): void {
  for (const item of items) {
    if (!NOTE_ITEM_CATEGORIES.has(item.category)) {
      throw new ApiError(
        "INVALID_FIELD",
        `Item category must be one of: ${[...NOTE_ITEM_CATEGORIES].join(", ")}.`,
        422,
      );
    }
  }
}

/** One multi-row insert for a note's items (bulk, so it can run inside a single
 *  transaction with the note write — no per-item round-trip, no partial note). */
function itemsInsertStmt(sql: SqlClient, noteId: string, items: NoteItemInput[]) {
  return sql`
    /* create_market_note_items */
    insert into market_note_items (note_id, category, competitor_brand, product, price, details)
    select ${noteId}::uuid, c, cb, p, pr, d
    from unnest(
      ${items.map((i) => i.category)}::text[],
      ${items.map((i) => i.competitorBrand ?? null)}::text[],
      ${items.map((i) => i.product ?? null)}::text[],
      ${items.map((i) => i.price ?? null)}::numeric[],
      ${items.map((i) => i.details ?? "")}::text[]
    ) as t(c, cb, p, pr, d)
    returning id, note_id as "noteId", category, competitor_brand as "competitorBrand", product, price, details
  `;
}

export async function listMarketNotes(
  sql: SqlClient,
  filters: { seUserId?: string | null; customerId?: string | null; from?: string | null; to?: string | null },
) {
  const noteRows = await sql`
    /* list_market_notes */
    select
      n.id,
      n.meeting_date as "meetingDate",
      n.se_user_id as "seUserId",
      se.name as "seName",
      n.customer_id as "customerId",
      c.legal_name as "customerName",
      n.note,
      n.created_by as "createdBy",
      cb.name as "createdByName",
      n.created_at as "createdAt"
    from market_notes n
    join users se on se.id = n.se_user_id
    left join customers c on c.id = n.customer_id
    left join users cb on cb.id = n.created_by
    where (${filters.seUserId ?? null}::uuid is null or n.se_user_id = ${filters.seUserId ?? null}::uuid)
      and (${filters.customerId ?? null}::uuid is null or n.customer_id = ${filters.customerId ?? null}::uuid)
      and (${filters.from ?? null}::date is null or n.meeting_date >= ${filters.from ?? null}::date)
      and (${filters.to ?? null}::date is null or n.meeting_date <= ${filters.to ?? null}::date)
    order by n.meeting_date desc, n.created_at desc
    limit 300
  ` as Row[];

  const notes = noteRows.map(mapNote);
  if (notes.length === 0) return [];

  const itemRows = await sql`
    /* list_market_note_items */
    select
      id,
      note_id as "noteId",
      category,
      competitor_brand as "competitorBrand",
      product,
      price,
      details
    from market_note_items
    where note_id = any(${notes.map((n) => n.id)}::uuid[])
    order by created_at
  ` as Row[];

  const byNote = new Map<string, ReturnType<typeof mapItem>[]>();
  for (const row of itemRows) {
    const key = str(row.noteId);
    if (!byNote.has(key)) byNote.set(key, []);
    byNote.get(key)!.push(mapItem(row));
  }

  return notes.map((n) => ({ ...n, items: byNote.get(n.id) ?? [] }));
}

export async function createMarketNote(
  sql: SqlClient,
  context: NoteContext,
  input: {
    meetingDate: string | null;
    seUserId: string;
    customerId: string | null;
    note: string;
    items: NoteItemInput[];
  },
) {
  assertValidItems(input.items);

  // Pre-generate the id so the note + its items insert in ONE transaction (a
  // mid-way failure no longer leaves a note with partial/missing items).
  const noteId = crypto.randomUUID();
  const noteStmt = sql`
    /* create_market_note */
    with inserted as (
      insert into market_notes (id, meeting_date, se_user_id, customer_id, note, created_by)
      values (
        ${noteId}::uuid,
        coalesce(${input.meetingDate}::date, (now() at time zone 'Asia/Kolkata')::date),
        ${input.seUserId}::uuid,
        ${input.customerId}::uuid,
        ${input.note},
        ${context.userId}::uuid
      )
      returning *
    )
    select
      i.id,
      i.meeting_date as "meetingDate",
      i.se_user_id as "seUserId",
      se.name as "seName",
      i.customer_id as "customerId",
      c.legal_name as "customerName",
      i.note,
      i.created_by as "createdBy",
      cb.name as "createdByName",
      i.created_at as "createdAt"
    from inserted i
    join users se on se.id = i.se_user_id
    left join customers c on c.id = i.customer_id
    left join users cb on cb.id = i.created_by
  `;
  const results = (await sql.transaction(
    input.items.length > 0 ? [noteStmt, itemsInsertStmt(sql, noteId, input.items)] : [noteStmt],
  )) as Row[][];

  const note = mapNote(results[0][0]);
  const items = (results[1] ?? []).map(mapItem);
  return { ...note, items };
}

export async function updateMarketNote(
  sql: SqlClient,
  noteId: string,
  input: {
    meetingDate: string | null;
    seUserId: string | null;
    customerId: string | null;
    note: string | null;
    items: NoteItemInput[] | null;
  },
) {
  if (input.items) assertValidItems(input.items);

  const [row] = await sql`
    /* update_market_note */
    with updated as (
      update market_notes
      set
        meeting_date = coalesce(${input.meetingDate}::date, meeting_date),
        se_user_id   = coalesce(${input.seUserId}::uuid, se_user_id),
        customer_id  = coalesce(${input.customerId}::uuid, customer_id),
        note         = coalesce(${input.note}, note),
        updated_at   = now()
      where id = ${noteId}::uuid
      returning *
    )
    select
      u.id,
      u.meeting_date as "meetingDate",
      u.se_user_id as "seUserId",
      se.name as "seName",
      u.customer_id as "customerId",
      c.legal_name as "customerName",
      u.note,
      u.created_by as "createdBy",
      cb.name as "createdByName",
      u.created_at as "createdAt"
    from updated u
    join users se on se.id = u.se_user_id
    left join customers c on c.id = u.customer_id
    left join users cb on cb.id = u.created_by
  ` as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Note not found.", 404);

  const note = mapNote(row);

  if (input.items) {
    // Replace the items atomically: delete + bulk re-insert in one transaction
    // (no window where the note has its old items deleted but new ones missing).
    const stmts = [
      sql`/* delete_market_note_items */ delete from market_note_items where note_id = ${noteId}::uuid`,
      ...(input.items.length > 0 ? [itemsInsertStmt(sql, noteId, input.items)] : []),
    ];
    const results = (await sql.transaction(stmts)) as Row[][];
    const items = (input.items.length > 0 ? (results[1] ?? []) : []).map(mapItem);
    return { ...note, items };
  }

  const itemRows = await sql`
    /* list_market_note_items */
    select id, note_id as "noteId", category, competitor_brand as "competitorBrand",
           product, price, details
    from market_note_items
    where note_id = any(${[noteId]}::uuid[])
    order by created_at
  ` as Row[];
  return { ...note, items: itemRows.map(mapItem) };
}

export async function deleteMarketNote(sql: SqlClient, noteId: string): Promise<void> {
  const rows = await sql`
    /* delete_market_note */
    delete from market_notes where id = ${noteId}::uuid returning id
  ` as Row[];
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Note not found.", 404);
}

/** All market-intelligence photos across customers, for the web gallery. */
export async function listMarketPhotos(
  sql: SqlClient,
  filters: { customerId?: string | null; from?: string | null; to?: string | null },
) {
  const rows = await sql`
    /* list_mi_photos */
    select
      p.id,
      p.customer_id as "customerId",
      c.legal_name as "customerName",
      c.customer_code as "customerCode",
      u.name as "uploadedByName",
      p.created_at as "createdAt"
    from customer_photos p
    join customers c on c.id = p.customer_id
    left join users u on u.id = p.uploaded_by
    where p.category = 'market_intelligence'
      and (${filters.customerId ?? null}::uuid is null or p.customer_id = ${filters.customerId ?? null}::uuid)
      and (${filters.from ?? null}::date is null or p.created_at >= ${filters.from ?? null}::date)
      and (${filters.to ?? null}::date is null or p.created_at < (${filters.to ?? null}::date + interval '1 day'))
    order by p.created_at desc
    limit 500
  ` as Row[];

  return rows.map((r) => ({
    id: str(r.id),
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    customerCode: str(r.customerCode),
    uploadedByName: nullStr(r.uploadedByName),
    createdAt: str(r.createdAt),
  }));
}
