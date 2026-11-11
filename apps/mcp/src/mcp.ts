import { McpServer } from "@modelcontextprotocol/server";
import { getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import { runReadOnlySql } from "./db";
import { SERVER_INSTRUCTIONS } from "./instructions";
import { validateSpec, type VardhanMapSpec } from "./spec";
import { MAP_TTL_MS } from "./maps-do";
import { getOperatingArea, hasExplicitScope } from "./operating-area";
import { newMapId, signToken } from "./map-links";

const RENDER_MAP_DESCRIPTION =
  "Render a geographic visualization of India (states or districts) and get back a " +
  "link to an INTERACTIVE map (zoom, hover, drill-down). Use it when the answer is " +
  "map-shaped — 'where', 'by district/state', routes, or points near a place. Build " +
  "the data with run_sql first, then pass a VardhanMapSpec: choropleth `data` is keyed " +
  "by state or district name; `markers`/`routes` take lat/lng. The link is short-lived.";

/** zod mirror of VardhanMapSpec for the tool input (validateSpec double-checks). */
const mapSpecSchema = z.object({
  version: z.literal("1"),
  map: z.object({
    region: z.enum(["india", "state", "district"]),
    state: z.string().optional(),
    states: z.array(z.string()).optional(),
  }),
  visualization: z.enum(["default", "choropleth", "markers", "routes", "heatmap"]),
  data: z.array(z.object({ key: z.string(), value: z.number() })).optional(),
  markers: z
    .array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional(), color: z.string().optional(), radius: z.number().optional(), popup: z.string().optional(), permanent: z.boolean().optional() }))
    .optional(),
  routes: z
    .array(z.object({ points: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() })), color: z.string().optional(), weight: z.number().optional(), label: z.string().optional(), showPoints: z.boolean().optional() }))
    .optional(),
  options: z
    .object({ title: z.string().optional(), legend: z.boolean().optional(), tooltip: z.boolean().optional(), basemap: z.enum(["vector", "raster", "none"]).optional(), colors: z.array(z.string()).optional() })
    .optional(),
});

const RUN_SQL_DESCRIPTION =
  "Run ONE read-only SQL query against the Sri Aparajita distribution database (a Neon read " +
  "replica — SELECT only; writes are rejected). Discover the schema with information_schema " +
  "(e.g. `select table_name, column_name, data_type from information_schema.columns where " +
  "table_schema='public'`). Results are capped at 5000 rows (a `truncated` flag signals more). " +
  "Prefer explicit LIMITs. Money is numeric; dates are IST.";

const AUDIT_DESCRIPTION =
  "Return the most recent SQL queries run through this MCP server (the audit log): each " +
  "entry has timestamp, ok/error, rowCount, elapsedMs and the SQL text. Read-only.";

/**
 * The authenticated enterprise for the current MCP request, from the OAuth grant
 * props (set in auth.ts). Request-scoped via AsyncLocalStorage, so it never
 * crosses between concurrent connectors. Null only if something authorized a
 * grant without an enterprise (shouldn't happen) — tools then refuse.
 */
function currentEnterpriseId(): string | null {
  const ctx = getMcpAuthContext() as { props?: { enterpriseId?: unknown } } | undefined;
  const id = ctx?.props?.enterpriseId;
  return typeof id === "string" && id ? id : null;
}

/** Best-effort audit write — never let a logging failure break the query. Audit
 *  is per-enterprise so one enterprise never sees another's query history. */
async function audit(
  getEnv: () => Env,
  enterpriseId: string,
  entry: import("./audit-do").AuditEntry,
): Promise<void> {
  try {
    const ns = getEnv().AUDIT_DO;
    await ns.get(ns.idFromName(`audit:${enterpriseId}`)).log(entry);
  } catch {
    /* ignore audit failures */
  }
}

/**
 * Build a fresh MCP server (SDK v2) for one request. `getEnv` returns the Worker
 * env so the tools can read the replica connection string / audit DO at call time.
 */
export function buildServer(getEnv: () => Env): McpServer {
  const server = new McpServer(
    { name: "sri-aparajita-mcp", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "run_sql",
    {
      title: "Run read-only SQL",
      description: RUN_SQL_DESCRIPTION,
      inputSchema: { query: z.string().describe("A single read-only SQL SELECT statement.") },
    },
    async ({ query }) => {
      const started = Date.now();
      const enterpriseId = currentEnterpriseId();
      if (!enterpriseId) {
        return { content: [{ type: "text", text: "Not authorized to an enterprise." }], isError: true };
      }
      try {
        const result = await runReadOnlySql(getEnv().REPLICA_DATABASE_URL, enterpriseId, query);
        await audit(getEnv, enterpriseId, {
          ts: new Date().toISOString(),
          ok: true,
          rowCount: result.rowCount,
          truncated: result.truncated,
          elapsedMs: result.elapsedMs,
          sql: query,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await audit(getEnv, enterpriseId, {
          ts: new Date().toISOString(),
          ok: false,
          rowCount: null,
          truncated: false,
          elapsedMs: Date.now() - started,
          sql: query,
          error: message,
        });
        return { content: [{ type: "text", text: `SQL error: ${message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    "get_audit_log",
    {
      title: "Recent query audit log",
      description: AUDIT_DESCRIPTION,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("How many recent entries to return (default 20)."),
      },
    },
    async ({ limit }) => {
      const enterpriseId = currentEnterpriseId();
      if (!enterpriseId) {
        return { content: [{ type: "text", text: "Not authorized to an enterprise." }], isError: true };
      }
      const ns = getEnv().AUDIT_DO;
      const entries = await ns.get(ns.idFromName(`audit:${enterpriseId}`)).recent(limit ?? 20);
      return { content: [{ type: "text", text: JSON.stringify(entries) }] };
    },
  );

  server.registerTool(
    "render_map",
    {
      title: "Render an interactive India map",
      description: RENDER_MAP_DESCRIPTION,
      inputSchema: { spec: mapSpecSchema },
    },
    async ({ spec }) => {
      const errors = validateSpec(spec);
      if (errors.length > 0) {
        const text = "Invalid map spec:\n" + errors.map((e) => `- ${e.path || "(root)"}: ${e.message}`).join("\n");
        return { content: [{ type: "text", text }], isError: true };
      }
      const env = getEnv();
      if (!env.MAP_SIGNING_SECRET || !env.PUBLIC_ORIGIN) {
        return {
          content: [{ type: "text", text: "Map rendering is not configured (MAP_SIGNING_SECRET / PUBLIC_ORIGIN)." }],
          isError: true,
        };
      }
      const enterpriseId = currentEnterpriseId();
      if (!enterpriseId) {
        return { content: [{ type: "text", text: "Not authorized to an enterprise." }], isError: true };
      }
      // Scope to the enterprise's operating districts by default — a distributor
      // works in a few districts, not all of India — unless the spec names its own.
      let finalSpec = spec as VardhanMapSpec;
      if (!hasExplicitScope(finalSpec.map)) {
        const operating = await getOperatingArea(env.REPLICA_DATABASE_URL, enterpriseId);
        if (operating) {
          finalSpec = { ...finalSpec, map: { ...finalSpec.map, region: "district", districts: operating } };
        }
      }
      const id = newMapId();
      const ns = env.MAPS_DO;
      await ns.get(ns.idFromName("maps")).put(id, finalSpec);
      const exp = Date.now() + MAP_TTL_MS;
      const token = await signToken(id, exp, env.MAP_SIGNING_SECRET);
      const url = `${env.PUBLIC_ORIGIN}/m/${id}?t=${token}`;
      const title = finalSpec.options?.title ?? "Map";
      return {
        content: [
          {
            type: "text",
            text: `${title} — interactive map (zoom / hover / drill-down), link valid ~24h:\n${url}`,
          },
        ],
      };
    },
  );

  return server;
}
