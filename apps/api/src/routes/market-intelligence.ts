import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { optionalString, readJsonObject, requiredString } from "../lib/request-body";
import {
  createMarketNote,
  deleteMarketNote,
  listMarketNotes,
  listMarketPhotos,
  updateMarketNote,
  type NoteItemInput,
} from "../services/market-intelligence";
import type { ApiEnv } from "../types";

/** Meeting-note intelligence is for the leadership pair only. */
// sectionGuard("market-intelligence") gates configurable roles; ACCOUNTANT
// included so a granted Accountant gets the section (read + its notes/photos).
const MI_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

function parseItems(raw: unknown): NoteItemInput[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) {
    throw new ApiError("INVALID_FIELD", "items must be an array.", 422);
  }
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ApiError("INVALID_FIELD", `items[${i}] must be an object.`, 422);
    }
    const item = entry as Record<string, unknown>;
    return {
      category: typeof item.category === "string" ? item.category : "other",
      competitorBrand: typeof item.competitorBrand === "string" ? item.competitorBrand : null,
      product: typeof item.product === "string" ? item.product : null,
      price: typeof item.price === "number" ? item.price : null,
      details: typeof item.details === "string" ? item.details : "",
    };
  });
}

export const marketIntelligenceRoutes = new Hono<ApiEnv>()
  .get("/notes", async (c) => {
    requireRole(c, [...MI_ROLES]);
    const { seUserId, customerId, from, to } = c.req.query();
    const notes = await listMarketNotes(getSqlClient(c), {
      seUserId: seUserId ?? null,
      customerId: customerId ?? null,
      from: from ?? null,
      to: to ?? null,
    });
    return c.json(success(c, { notes }));
  })
  .post("/notes", async (c) => {
    const auth = requireRole(c, [...MI_ROLES]);
    const body = await readJsonObject(c);

    const sql = getSqlClient(c);
    const note = await createMarketNote(
      sql,
      { userId: auth.userId! },
      {
        meetingDate: optionalString(body, "meetingDate"),
        seUserId: requiredString(body, "seUserId"),
        customerId: optionalString(body, "customerId"),
        note: optionalString(body, "note") ?? "",
        items: parseItems(body.items) ?? [],
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "market_note.create",
      entityType: "market_note",
      entityId: note.id,
      summary: "Recorded a market-intelligence note",
    });
    return c.json(success(c, { note }), 201);
  })
  .patch("/notes/:id", async (c) => {
    const auth = requireRole(c, [...MI_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);

    const note = await updateMarketNote(sql, c.req.param("id"), {
      meetingDate: optionalString(body, "meetingDate"),
      seUserId: optionalString(body, "seUserId"),
      customerId: optionalString(body, "customerId"),
      note: optionalString(body, "note"),
      items: parseItems(body.items),
    });
    await logAudit(sql, actorOf(auth), {
      action: "market_note.update",
      entityType: "market_note",
      entityId: note.id,
      summary: "Updated a market-intelligence note",
    });
    return c.json(success(c, { note }));
  })
  .delete("/notes/:id", async (c) => {
    const auth = requireRole(c, [...MI_ROLES]);
    const sql = getSqlClient(c);
    await deleteMarketNote(sql, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "market_note.delete",
      entityType: "market_note",
      entityId: c.req.param("id"),
      summary: "Deleted a market-intelligence note",
    });
    return c.json(success(c, { deleted: true }));
  })
  .get("/photos", async (c) => {
    requireRole(c, [...MI_ROLES]);
    const { customerId, from, to } = c.req.query();
    const photos = await listMarketPhotos(getSqlClient(c), {
      customerId: customerId ?? null,
      from: from ?? null,
      to: to ?? null,
    });
    return c.json(success(c, { photos }));
  });
