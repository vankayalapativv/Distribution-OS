import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import { assertCustomerVisible } from "./customers";
import type { Role } from "../types";

interface NoteContext {
  userId: string;
  role?: Role | null;
}

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  edited: boolean;
  editedAt: string | null;
  editorName: string | null;
}

/** timestamptz arrives from Neon as a JS Date — normalise to ISO for the client. */
function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

function mapNote(r: Record<string, unknown>): CustomerNote {
  const editedAt = iso(r.editedAt);
  return {
    id: r.id as string,
    body: r.body as string,
    createdAt: iso(r.createdAt) ?? "",
    authorName: (r.authorName as string | null) ?? "Unknown",
    edited: editedAt !== null,
    editedAt,
    editorName: (r.editorName as string | null) ?? null,
  };
}

/** All notes on a customer, newest first — one shared thread. */
export async function listCustomerNotes(
  sql: SqlClient,
  context: NoteContext,
  customerId: string,
): Promise<CustomerNote[]> {
  await assertCustomerVisible(sql, context, customerId);
  const rows = await sql`
    /* list_customer_notes */
    select n.id, n.body, n.created_at as "createdAt",
           a.name as "authorName", n.edited_at as "editedAt", e.name as "editorName"
    from customer_notes n
    join users a on a.id = n.created_by
    left join users e on e.id = n.edited_by
    where n.customer_id = ${customerId}::uuid
    order by n.created_at desc
  `;
  return rows.map(mapNote);
}

/** Add a note. Anyone who can see the customer may add (add-only). */
export async function createCustomerNote(
  sql: SqlClient,
  context: NoteContext,
  customerId: string,
  body: string,
): Promise<CustomerNote> {
  await assertCustomerVisible(sql, context, customerId);
  const rows = await sql`
    /* create_customer_note */
    with inserted as (
      insert into customer_notes (customer_id, body, created_by)
      values (${customerId}::uuid, ${body}, ${context.userId}::uuid)
      returning id, body, created_at, created_by, edited_at, edited_by
    )
    select i.id, i.body, i.created_at as "createdAt",
           a.name as "authorName", i.edited_at as "editedAt", null as "editorName"
    from inserted i join users a on a.id = i.created_by
  `;
  return mapNote(rows[0]);
}

/** Edit a note — SUPER_ADMIN only (enforced in the route). Marks it edited. */
export async function updateCustomerNote(
  sql: SqlClient,
  customerId: string,
  noteId: string,
  body: string,
  editorId: string,
): Promise<CustomerNote> {
  const rows = await sql`
    /* update_customer_note */
    with updated as (
      update customer_notes
      set body = ${body}, edited_at = now(), edited_by = ${editorId}::uuid
      where id = ${noteId}::uuid and customer_id = ${customerId}::uuid
      returning id, body, created_at, created_by, edited_at, edited_by
    )
    select u.id, u.body, u.created_at as "createdAt",
           a.name as "authorName", u.edited_at as "editedAt", e.name as "editorName"
    from updated u
    join users a on a.id = u.created_by
    left join users e on e.id = u.edited_by
  `;
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Note not found.", 404);
  return mapNote(rows[0]);
}

/** Delete a note — SUPER_ADMIN only (enforced in the route). */
export async function deleteCustomerNote(
  sql: SqlClient,
  customerId: string,
  noteId: string,
): Promise<void> {
  const rows = await sql`
    /* delete_customer_note */
    delete from customer_notes
    where id = ${noteId}::uuid and customer_id = ${customerId}::uuid
    returning id
  `;
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Note not found.", 404);
}
