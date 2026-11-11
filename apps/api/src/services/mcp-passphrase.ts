import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";

/**
 * Per-enterprise MCP passphrase (Phase 4). Each enterprise has ONE passphrase a
 * connector uses to reach the MCP server; the MCP worker SHA-256s the submitted
 * secret and resolves it to this enterprise_id (then runs every query under RLS).
 *
 * We store ONLY the SHA-256 — the plaintext is shown to the admin exactly once,
 * at generation (like the user 'Set password' flow). Runs on the scoped client,
 * so RLS confines every read/write to the caller's own enterprise row.
 */

export interface McpPassphraseStatus {
  /** Whether MCP access is enabled for this enterprise. */
  enabled: boolean;
  /** Whether a passphrase has been generated (the hash is stored). */
  passphraseSet: boolean;
  passphraseSetAt: string | null;
  updatedAt: string | null;
}

function asIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
}

/** Lowercase hex SHA-256 (Web Crypto — Workers runtime). */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A readable, high-entropy passphrase: `mcp_` + 24 Crockford-base32 chars (~120 bits). */
function generatePassphrase(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I/L/O/U)
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const body = [...bytes].map((b) => alphabet[b % 32]).join("");
  return `mcp_${body.slice(0, 8)}-${body.slice(8, 16)}-${body.slice(16, 24)}`;
}

/** The current enterprise's MCP status (never returns the passphrase). */
export async function getMcpPassphraseStatus(sql: SqlClient): Promise<McpPassphraseStatus> {
  const [row] = (await sql`
    /* mcp_passphrase_status */
    select enabled, (passphrase_sha256 is not null) as "passphraseSet",
           passphrase_set_at as "passphraseSetAt", updated_at as "updatedAt"
    from enterprise_mcp_config
    limit 1
  `) as Array<Record<string, unknown>>;
  if (!row) return { enabled: false, passphraseSet: false, passphraseSetAt: null, updatedAt: null };
  return {
    enabled: Boolean(row.enabled),
    passphraseSet: Boolean(row.passphraseSet),
    passphraseSetAt: asIso(row.passphraseSetAt),
    updatedAt: asIso(row.updatedAt),
  };
}

/**
 * Generate (or rotate) this enterprise's MCP passphrase. Returns the plaintext
 * ONCE — it is never retrievable again (only the SHA-256 is stored). Enabling
 * access is implied (a freshly set passphrase turns MCP on).
 */
export async function generateMcpPassphrase(
  sql: SqlClient,
  userId: string | null,
): Promise<{ passphrase: string }> {
  const passphrase = generatePassphrase();
  const hash = await sha256Hex(passphrase);
  await sql`
    /* mcp_passphrase_upsert */
    insert into enterprise_mcp_config (passphrase_sha256, passphrase_set_at, enabled, updated_by, updated_at)
    values (${hash}, now(), true, ${userId}, now())
    on conflict (enterprise_id) do update
      set passphrase_sha256 = excluded.passphrase_sha256,
          passphrase_set_at = now(), enabled = true,
          updated_by = ${userId}, updated_at = now()
  `;
  return { passphrase };
}

/** Enable/disable MCP access for this enterprise (a passphrase must exist). */
export async function setMcpEnabled(
  sql: SqlClient,
  enabled: boolean,
  userId: string | null,
): Promise<McpPassphraseStatus> {
  const rows = (await sql`
    /* mcp_passphrase_set_enabled */
    update enterprise_mcp_config
       set enabled = ${enabled}, updated_by = ${userId}, updated_at = now()
     where passphrase_sha256 is not null
    returning enabled
  `) as Array<{ enabled: boolean }>;
  if (rows.length === 0) {
    throw new ApiError("NO_PASSPHRASE", "Generate an MCP passphrase before enabling access.", 409);
  }
  return getMcpPassphraseStatus(sql);
}
