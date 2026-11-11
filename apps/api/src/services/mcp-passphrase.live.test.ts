import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { createScopedSqlClient } from "../lib/db";
import { generateMcpPassphrase, getMcpPassphraseStatus, setMcpEnabled } from "./mcp-passphrase";

/**
 * Phase 4 end-to-end seam (live): the REAL API generate path → the MCP resolve
 * path must agree. We generate a passphrase through the actual scoped service
 * (RLS-enforced write), then resolve it exactly as the MCP worker does — standard
 * SHA-256 → mcp_resolve_enterprise — and assert it maps back to the SAME
 * enterprise. Proves both halves hash identically and the resolver works on a
 * real row. Seeds a throwaway enterprise and cleans it up. Skipped without
 * LIVE_DATABASE_URL.
 */
const URL = process.env.LIVE_DATABASE_URL;
const d = URL ? describe : describe.skip;

/** Standard SHA-256 hex — the same digest the MCP worker computes via Web Crypto. */
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let entId = "";

d("API generate → MCP resolve (live)", () => {
  afterAll(async () => {
    if (!entId) return;
    const sql = neon(URL!);
    await sql`delete from enterprise_mcp_config where enterprise_id = ${entId}`;
    await sql`delete from enterprises where id = ${entId}`;
  });

  it("a passphrase made by the API resolves (via SHA-256) to its own enterprise", async () => {
    const owner = neon(URL!);
    const [e] = (await owner`
      insert into enterprises (name, legal_name, gstin, contact_name, contact_phone, contact_email,
        address_line1, address_city, address_state, address_pincode, status)
      values ('MCP RT', 'MCP RT Pvt', '00AAAAA0000A0Z0', 'P', '+910000000000', 'p@x.test',
        '1 St', 'City', 'Telangana', '500001', 'active')
      returning id`) as Array<{ id: string }>;
    entId = e.id;

    // Generate through the REAL scoped service (RLS pins the write to this enterprise).
    const scoped = createScopedSqlClient(owner, entId, null);
    const { passphrase } = await generateMcpPassphrase(scoped, null);
    expect(passphrase).toMatch(/^mcp_/);

    // Resolve exactly as the MCP worker does: SHA-256 → mcp_resolve_enterprise.
    const [r] = (await owner`select public.mcp_resolve_enterprise(${sha256(passphrase)}) as eid`) as Array<{ eid: string | null }>;
    expect(r.eid).toBe(entId); // API-stored hash == MCP-computed hash == resolves here

    // Wrong passphrase resolves to nothing.
    const [bad] = (await owner`select public.mcp_resolve_enterprise(${sha256("wrong")}) as eid`) as Array<{ eid: string | null }>;
    expect(bad.eid).toBeNull();

    // Status reflects the generated passphrase (scoped read).
    const status = await getMcpPassphraseStatus(scoped);
    expect(status).toMatchObject({ enabled: true, passphraseSet: true });

    // Disable → the resolver stops returning the enterprise (per-enterprise off switch).
    await setMcpEnabled(scoped, false, null);
    const [off] = (await owner`select public.mcp_resolve_enterprise(${sha256(passphrase)}) as eid`) as Array<{ eid: string | null }>;
    expect(off.eid).toBeNull();
  });
});
