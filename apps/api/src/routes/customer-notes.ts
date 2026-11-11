import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject, requiredString } from "../lib/request-body";
import {
  createCustomerNote,
  deleteCustomerNote,
  listCustomerNotes,
  updateCustomerNote,
} from "../services/customer-notes";
import { actorOf, logAudit } from "../services/audit";
import type { ApiEnv } from "../types";

// SE + all office roles may read and add; only SUPER_ADMIN may edit or delete.
const NOTE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "SALES_EXECUTIVE"] as const;

function requireBody(raw: Record<string, unknown>): string {
  const body = requiredString(raw, "body").trim();
  if (body.length === 0) throw new ApiError("INVALID_FIELD", "The note can't be empty.", 422);
  return body;
}

/** Per-customer notes thread: /customers/:id/notes */
export const customerNotesRoutes = new Hono<ApiEnv>()
  .get("/:id/notes", async (c) => {
    const auth = requireRole(c, [...NOTE_ROLES]);
    const notes = await listCustomerNotes(
      getSqlClient(c),
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
    );
    return c.json(success(c, { notes }));
  })
  .post("/:id/notes", async (c) => {
    const auth = requireRole(c, [...NOTE_ROLES]);
    const body = requireBody(await readJsonObject(c));
    const sql = getSqlClient(c);
    const note = await createCustomerNote(
      sql,
      { userId: auth.userId!, role: auth.role },
      c.req.param("id"),
      body,
    );
    await logAudit(sql, actorOf(auth), {
      action: "customer_note.create",
      entityType: "customer",
      entityId: c.req.param("id"),
      summary: "Added a customer note",
    });
    return c.json(success(c, note), 201);
  })
  .patch("/:id/notes/:noteId", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = requireBody(await readJsonObject(c));
    const sql = getSqlClient(c);
    const note = await updateCustomerNote(
      sql,
      c.req.param("id"),
      c.req.param("noteId"),
      body,
      auth.userId!,
    );
    await logAudit(sql, actorOf(auth), {
      action: "customer_note.update",
      entityType: "customer",
      entityId: c.req.param("id"),
      summary: "Edited a customer note",
      metadata: { noteId: c.req.param("noteId") },
    });
    return c.json(success(c, note));
  })
  .delete("/:id/notes/:noteId", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    await deleteCustomerNote(sql, c.req.param("id"), c.req.param("noteId"));
    await logAudit(sql, actorOf(auth), {
      action: "customer_note.delete",
      entityType: "customer",
      entityId: c.req.param("id"),
      summary: "Deleted a customer note",
      metadata: { noteId: c.req.param("noteId") },
    });
    return c.json(success(c, { deleted: true }));
  });
