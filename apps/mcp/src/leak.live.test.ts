import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { resolveEnterpriseByPassphrase, runReadOnlySql, sha256Hex } from "./db";

/**
 * Phase 4 go-live gate: a REAL cross-enterprise leak test against a live DB.
 *
 * Seeds two enterprises (A, B) each with a marker row, gives each its own MCP
 * passphrase, then proves the scoped run_sql path can NEVER see across the
 * boundary: A's passphrase resolves to A, a query scoped to A returns only A's
 * rows (zero of B's), and vice versa. If RLS or the role-switch regressed, these
 * fail. Skipped unless LIVE_DATABASE_URL (the owner connection) is set.
 */
const URL = process.env.LIVE_DATABASE_URL;
const d = URL ? describe : describe.skip;

const PASS_A = "leak-test-pass-AAAA-1111";
const PASS_B = "leak-test-pass-BBBB-2222";
const PROBE_KEY = "__mcp_leak_probe__";

let idA = "";
let idB = "";

function entCols(name: string) {
  // All NOT NULL text columns on enterprises, with throwaway values.
  return {
    name,
    legal_name: `${name} Pvt Ltd`,
    gstin: "00AAAAA0000A0Z0",
    contact_name: "Probe",
    contact_phone: "+910000000000",
    contact_email: "probe@example.test",
    address_line1: "1 Probe St",
    address_city: "Probeville",
    address_state: "Telangana",
    address_pincode: "500001",
  };
}

d("MCP cross-enterprise isolation (live)", () => {
  beforeAll(async () => {
    const sql = neon(URL!);
    const mk = async (name: string, pass: string, marker: string): Promise<string> => {
      const c = entCols(name);
      const [e] = (await sql`
        insert into enterprises (name, legal_name, gstin, contact_name, contact_phone, contact_email,
          address_line1, address_city, address_state, address_pincode, status)
        values (${c.name}, ${c.legal_name}, ${c.gstin}, ${c.contact_name}, ${c.contact_phone}, ${c.contact_email},
          ${c.address_line1}, ${c.address_city}, ${c.address_state}, ${c.address_pincode}, 'active')
        returning id`) as Array<{ id: string }>;
      const id = e.id;
      await sql`insert into system_settings (enterprise_id, key, value) values (${id}, ${PROBE_KEY}, ${marker})`;
      await sql`insert into enterprise_mcp_config (enterprise_id, passphrase_sha256, enabled)
                values (${id}, ${await sha256Hex(pass)}, true)`;
      return id;
    };
    idA = await mk("MCP Leak A", PASS_A, "A");
    idB = await mk("MCP Leak B", PASS_B, "B");
  });

  afterAll(async () => {
    if (!idA && !idB) return;
    const sql = neon(URL!);
    // ON DELETE CASCADE on enterprise_mcp_config; delete system_settings + enterprises explicitly.
    await sql`delete from system_settings where enterprise_id = any(${[idA, idB]})`;
    await sql`delete from enterprise_mcp_config where enterprise_id = any(${[idA, idB]})`;
    await sql`delete from enterprises where id = any(${[idA, idB]})`;
  });

  it("resolves each passphrase to its own enterprise, and rejects a wrong one", async () => {
    expect(await resolveEnterpriseByPassphrase(URL!, PASS_A)).toBe(idA);
    expect(await resolveEnterpriseByPassphrase(URL!, PASS_B)).toBe(idB);
    expect(await resolveEnterpriseByPassphrase(URL!, "definitely-wrong")).toBeNull();
  });

  it("a query scoped to A sees A's marker and NONE of B's", async () => {
    const q = `select enterprise_id, value from system_settings where key = '${PROBE_KEY}'`;
    const a = await runReadOnlySql(URL!, idA, q);
    const aVals = a.rows.map((r) => r.value);
    expect(aVals).toContain("A");
    expect(aVals).not.toContain("B");
    expect(a.rows.every((r) => r.enterprise_id === idA)).toBe(true);
  });

  it("a query scoped to B sees B's marker and NONE of A's", async () => {
    const q = `select enterprise_id, value from system_settings where key = '${PROBE_KEY}'`;
    const b = await runReadOnlySql(URL!, idB, q);
    const bVals = b.rows.map((r) => r.value);
    expect(bVals).toContain("B");
    expect(bVals).not.toContain("A");
    expect(b.rows.every((r) => r.enterprise_id === idB)).toBe(true);
  });

  it("scoped reads cannot reach another enterprise's customers either (count stays own-only)", async () => {
    // Blunt check across a business table: A's count never includes B's rows.
    const countFor = async (id: string) =>
      Number((await runReadOnlySql(URL!, id, "select count(*)::int as n from customers")).rows[0]?.n ?? -1);
    // Both are fresh enterprises with zero customers; the point is the query runs
    // under RLS (no error, own-scoped) rather than leaking a global count.
    expect(await countFor(idA)).toBe(0);
    expect(await countFor(idB)).toBe(0);
  });
});
