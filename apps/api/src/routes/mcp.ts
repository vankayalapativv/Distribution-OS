import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { readJsonObject } from "../lib/request-body";
import { validate } from "../lib/validate";
import { actorOf, logAudit } from "../services/audit";
import { getInboundAudit, getInboundStatus, patchInboundConfig } from "../services/mcp-inbound";
import {
  generateMcpPassphrase,
  getMcpPassphraseStatus,
  setMcpEnabled,
} from "../services/mcp-passphrase";
import type { ApiEnv } from "../types";

const OFFICE_ADMIN = ["SUPER_ADMIN", "MANAGER"] as const;

const EnabledSchema = z.object({ enabled: z.boolean() });

const ServerConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    // null / "" clears the passphrase (falls back to the env secret).
    passphrase: z
      .union([z.string().min(8, "Passphrase must be at least 8 characters."), z.literal(""), z.null()])
      .optional(),
  })
  .refine((v) => v.enabled !== undefined || v.passphrase !== undefined, "Nothing to update.");

// Inbound MCP server (apps/mcp) — status / on-off / passphrase / audit. The web
// talks only to this API, which proxies to the MCP server's /admin API with the
// shared secret. SUPER_ADMIN + MANAGER only.
export const mcpRoutes = new Hono<ApiEnv>()
  .get("/server", async (c) => {
    requireRole(c, [...OFFICE_ADMIN]);
    return c.json(success(c, await getInboundStatus(c.env)));
  })
  .patch("/server", async (c) => {
    const auth = requireRole(c, [...OFFICE_ADMIN]);
    const input = validate(ServerConfigSchema, await readJsonObject(c));
    const status = await patchInboundConfig(c.env, {
      enabled: input.enabled,
      passphrase: input.passphrase,
      updatedBy: auth.email ?? auth.userId ?? null,
    });
    const onOff = input.enabled ? "turned on" : "turned off";
    await logAudit(getSqlClient(c), actorOf(auth), {
      action: "mcp.server.update",
      entityType: "mcp_server",
      summary: input.enabled !== undefined ? `MCP server ${onOff}` : "MCP passphrase changed",
      metadata: { enabled: input.enabled, passphraseChanged: input.passphrase !== undefined },
    });
    return c.json(success(c, status));
  })
  .get("/server/audit", async (c) => {
    requireRole(c, [...OFFICE_ADMIN]);
    const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 50) || 50, 500));
    return c.json(success(c, await getInboundAudit(c.env, limit)));
  })

  // ── Per-enterprise MCP passphrase (Phase 4) — SUPER_ADMIN only ──────────────
  // This enterprise's own connector passphrase, stored hashed in the DB (scoped
  // by RLS). The global /server routes above are the platform-wide config; these
  // govern THIS enterprise's access.
  .get("/passphrase", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    return c.json(success(c, await getMcpPassphraseStatus(getSqlClient(c))));
  })
  .post("/passphrase", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    const { passphrase } = await generateMcpPassphrase(sql, auth.userId ?? null);
    await logAudit(sql, actorOf(auth), {
      action: "mcp.passphrase.generate",
      entityType: "mcp_passphrase",
      summary: "Generated a new MCP passphrase",
    });
    // The plaintext is returned ONCE and never stored — the UI shows it once.
    return c.json(success(c, { passphrase }), 201);
  })
  .patch("/passphrase", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const { enabled } = validate(EnabledSchema, await readJsonObject(c));
    const sql = getSqlClient(c);
    const status = await setMcpEnabled(sql, enabled, auth.userId ?? null);
    await logAudit(sql, actorOf(auth), {
      action: "mcp.passphrase.toggle",
      entityType: "mcp_passphrase",
      summary: enabled ? "Enabled MCP access" : "Disabled MCP access",
    });
    return c.json(success(c, status));
  });
