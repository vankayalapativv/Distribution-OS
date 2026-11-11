import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireAuth, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { optionalString, readJsonObject, requiredString } from "../lib/request-body";
import { validate } from "../lib/validate";
import {
  addErrorNote,
  captureError,
  errorSummary,
  getErrorGroupDetail,
  listErrorGroups,
  updateErrorGroup,
  type ErrorLevel,
  type ErrorSource,
} from "../services/errors";
import { listTaskAssignees } from "../services/tasks";
import type { ApiEnv } from "../types";

/** The error monitor is a SUPER_ADMIN-only surface. */
const ADMIN = ["SUPER_ADMIN"] as const;

const VALID_STATUS = new Set(["open", "resolved", "ignored"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Boundary schema for a client-reported error (audit G-0602). Bounded strings +
// enum source/level; the userId/role are taken from the token, never the body.
const ErrorIngestSchema = z.object({
  source: z.enum(["web", "mobile"]),
  message: z.string().min(1).transform((s) => s.slice(0, 4000)),
  level: z.enum(["error", "fatal", "warning"]).default("error"),
  stack: z.string().nullish().transform((s) => s?.slice(0, 12000) ?? null),
  kind: z.string().nullish(),
  route: z.string().nullish(),
  appVersion: z.string().nullish(),
  context: z.unknown().nullish(),
});

/** A malformed id is a not-found, not a DB cast error — guard before ::uuid. */
function groupId(c: { req: { param: (k: string) => string } }): string {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) throw new ApiError("NOT_FOUND", "Error group not found.", 404);
  return id;
}

export const errorsRoutes = new Hono<ApiEnv>()
  // Ingest a client-reported error (web dashboard or mobile app). Any signed-in
  // user may report their OWN error; the userId/role are taken from the token,
  // never trusted from the body. API server errors are captured in errorHandler,
  // not here.
  .post("/ingest", async (c) => {
    const auth = requireAuth(c);
    const input = validate(ErrorIngestSchema, await readJsonObject(c));

    await captureError(getSqlClient(c), {
      source: input.source,
      message: input.message,
      stack: input.stack,
      kind: input.kind ?? null,
      level: input.level,
      route: input.route ?? null,
      requestId: c.var.requestId,
      userId: auth.userId,
      role: auth.role,
      // Stamp the reporter's enterprise from the token (never the body), so an
      // ingested client error is isolated to its own tenant under RLS.
      enterpriseId: auth.enterpriseId,
      environment: c.env.ENVIRONMENT ?? "production",
      appVersion: input.appVersion ?? null,
      context: input.context ?? null,
    });

    return c.json(success(c, { accepted: true }), 202);
  })
  .get("/summary", async (c) => {
    requireRole(c, [...ADMIN]);
    return c.json(success(c, await errorSummary(getSqlClient(c))));
  })
  .get("/assignees", async (c) => {
    requireRole(c, [...ADMIN]);
    const assignees = await listTaskAssignees(getSqlClient(c));
    return c.json(success(c, { assignees }));
  })
  .get("/", async (c) => {
    requireRole(c, [...ADMIN]);
    const { status, source, level, page, pageSize } = c.req.query();
    const result = await listErrorGroups(getSqlClient(c), {
      status: status ?? null,
      source: source ?? null,
      level: level ?? null,
      page: Math.max(1, Math.floor(Number(page)) || 1),
      pageSize: Math.max(1, Math.floor(Number(pageSize)) || 50),
    });
    return c.json(success(c, result));
  })
  .get("/:id", async (c) => {
    requireRole(c, [...ADMIN]);
    const detail = await getErrorGroupDetail(getSqlClient(c), groupId(c));
    if (!detail) throw new ApiError("NOT_FOUND", "Error group not found.", 404);
    return c.json(success(c, detail));
  })
  .patch("/:id", async (c) => {
    const auth = requireRole(c, [...ADMIN]);
    const id = groupId(c);
    const body = await readJsonObject(c);
    const status = optionalString(body, "status");
    if (status && !VALID_STATUS.has(status)) {
      throw new ApiError("INVALID_FIELD", "status must be open, resolved, or ignored.", 422);
    }
    const ok = await updateErrorGroup(getSqlClient(c), id, auth.userId!, {
      status: status ?? null,
      // `assignedTo: null` clears; omitting the key leaves it unchanged.
      assignedTo: "assignedTo" in body ? optionalString(body, "assignedTo") : undefined,
    });
    if (!ok) throw new ApiError("NOT_FOUND", "Error group not found.", 404);
    return c.json(success(c, { updated: true }));
  })
  .post("/:id/notes", async (c) => {
    const auth = requireRole(c, [...ADMIN]);
    const id = groupId(c);
    const body = await readJsonObject(c);
    const text = requiredString(body, "body").trim();
    if (!text) throw new ApiError("INVALID_FIELD", "Note body cannot be empty.", 422);
    const note = await addErrorNote(getSqlClient(c), id, auth.userId!, text);
    return c.json(success(c, note), 201);
  });
