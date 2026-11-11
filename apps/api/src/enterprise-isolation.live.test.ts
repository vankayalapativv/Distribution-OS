import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createScopedSqlClient, type SqlClient } from "./lib/db";

/**
 * Phase 6 go-live gate: a REAL cross-enterprise leak test for the web + API path
 * (the scoped SQL client every authenticated request runs through — see
 * `getSqlClient` → `createScopedSqlClient` in lib/db.ts). The MCP path has its
 * own gate in apps/mcp/src/leak.live.test.ts.
 *
 * Seeds two enterprises (A, B), each with a marker customer + a system_settings
 * row, then proves, against the live DB and real Postgres RLS:
 *   1. a client scoped to A sees A's rows and ZERO of B's (and vice versa),
 *   2. the scope fails CLOSED — an unknown/empty enterprise sees nothing, while
 *      the unscoped owner sees both (so RLS, not a WHERE clause, is filtering),
 *   3. WITH CHECK blocks writing another enterprise's rows,
 *   4. a structural audit: EVERY public table carrying `enterprise_id` has RLS
 *      enabled and an enterprise-isolation policy — so a new table added without
 *      RLS fails this test instead of silently leaking.
 *
 * Skipped unless LIVE_DATABASE_URL (the owner connection) is set.
 */
const URL = process.env.LIVE_DATABASE_URL;
const d = URL ? describe : describe.skip;

const PROBE_KEY = "__api_leak_probe__";

let idA = "";
let idB = "";

function entCols(name: string, gstin: string) {
  return {
    name,
    legal_name: `${name} Pvt Ltd`,
    gstin,
    contact_name: "Probe",
    contact_phone: "+910000000000",
    contact_email: "probe@example.test",
    address_line1: "1 Probe St",
    address_city: "Probeville",
    address_state: "Telangana",
    address_pincode: "500001",
  };
}

d("API/web cross-enterprise isolation (live)", () => {
  const owner = () => neon(URL!);

  beforeAll(async () => {
    const sql = owner();
    const mk = async (name: string, gstin: string, code: string, marker: string): Promise<string> => {
      const c = entCols(name, gstin);
      const [e] = (await sql`
        insert into enterprises (name, legal_name, gstin, contact_name, contact_phone, contact_email,
          address_line1, address_city, address_state, address_pincode, status)
        values (${c.name}, ${c.legal_name}, ${c.gstin}, ${c.contact_name}, ${c.contact_phone}, ${c.contact_email},
          ${c.address_line1}, ${c.address_city}, ${c.address_state}, ${c.address_pincode}, 'active')
        returning id`) as Array<{ id: string }>;
      const id = e.id;
      await sql`insert into customers (enterprise_id, customer_code, legal_name, customer_type)
                values (${id}, ${code}, ${`${name} Customer`}, 'retail')`;
      await sql`insert into system_settings (enterprise_id, key, value) values (${id}, ${PROBE_KEY}, ${marker})`;
      return id;
    };
    idA = await mk("API Leak A", "00AAAAA0000A0Z0", "LEAK-A-0001", "A");
    idB = await mk("API Leak B", "00BBBBB0000B0Z0", "LEAK-B-0001", "B");
  });

  afterAll(async () => {
    if (!idA && !idB) return;
    const sql = owner();
    const ids = [idA, idB].filter(Boolean);
    await sql`delete from system_settings where enterprise_id = any(${ids})`;
    await sql`delete from customers where enterprise_id = any(${ids})`;
    await sql`delete from enterprises where id = any(${ids})`;
  });

  const count = async (sql: SqlClient, table: "customers" | "system_settings") =>
    Number(((await sql.query(`select count(*)::int as n from ${table}`)) as Array<{ n: number }>)[0]?.n ?? -1);

  it("a client scoped to A sees A's marker rows and NONE of B's", async () => {
    const a = createScopedSqlClient(owner(), idA, null);

    const custs = (await a`select enterprise_id, customer_code from customers`) as Array<{
      enterprise_id: string;
      customer_code: string;
    }>;
    expect(custs.every((r) => r.enterprise_id === idA)).toBe(true);
    expect(custs.map((r) => r.customer_code)).toContain("LEAK-A-0001");
    expect(custs.map((r) => r.customer_code)).not.toContain("LEAK-B-0001");

    const settings = (await a`select enterprise_id, value from system_settings where key = ${PROBE_KEY}`) as Array<{
      enterprise_id: string;
      value: string;
    }>;
    expect(settings.map((r) => r.value)).toEqual(["A"]);
    expect(settings.every((r) => r.enterprise_id === idA)).toBe(true);
  });

  it("a client scoped to B sees B's marker rows and NONE of A's", async () => {
    const b = createScopedSqlClient(owner(), idB, null);
    const settings = (await b`select enterprise_id, value from system_settings where key = ${PROBE_KEY}`) as Array<{
      enterprise_id: string;
      value: string;
    }>;
    expect(settings.map((r) => r.value)).toEqual(["B"]);
    expect(settings.every((r) => r.enterprise_id === idB)).toBe(true);
  });

  it("cannot fetch another enterprise's row even by its exact id", async () => {
    const a = createScopedSqlClient(owner(), idA, null);
    const stolen = (await a`select id from customers where enterprise_id = ${idB}`) as Array<{ id: string }>;
    expect(stolen).toHaveLength(0);
  });

  it("fails CLOSED: an unknown enterprise scope sees nothing, while the owner sees both", async () => {
    const ghost = createScopedSqlClient(owner(), "00000000-0000-4000-8000-000000000000", null);
    expect(await count(ghost, "customers")).toBe(0);
    expect(await count(ghost, "system_settings")).toBe(0);

    // The unscoped owner is NOT filtered by RLS — it sees both markers. This
    // proves the zeros above come from RLS, not from the rows being absent.
    const bothMarkers = (await owner()`
      select value from system_settings where key = ${PROBE_KEY} and enterprise_id = any(${[idA, idB]})
      order by value`) as Array<{ value: string }>;
    expect(bothMarkers.map((r) => r.value)).toEqual(["A", "B"]);
  });

  it("WITH CHECK blocks a scoped client from writing another enterprise's row", async () => {
    const a = createScopedSqlClient(owner(), idA, null);
    await expect(
      a`insert into system_settings (enterprise_id, key, value) values (${idB}, ${"__leak_write__"}, ${"x"})`,
    ).rejects.toThrow();
    // And confirm nothing landed under B.
    const leaked = (await owner()`
      select 1 from system_settings where enterprise_id = ${idB} and key = ${"__leak_write__"}`) as unknown[];
    expect(leaked).toHaveLength(0);
  });

  it("structural audit: every table with an enterprise_id column has RLS + an isolation policy", async () => {
    const rows = (await owner()`
      select c.relname,
             c.relrowsecurity as rls_enabled,
             exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname
                 and (coalesce(p.qual, '') like '%app_current_enterprise_id%'
                      or coalesce(p.with_check, '') like '%app_current_enterprise_id%')
             ) as has_isolation_policy
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (
          select 1 from information_schema.columns col
          where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'enterprise_id'
        )
      order by c.relname`) as Array<{ relname: string; rls_enabled: boolean; has_isolation_policy: boolean }>;

    expect(rows.length).toBeGreaterThan(50);
    const unprotected = rows.filter((r) => !r.rls_enabled || !r.has_isolation_policy).map((r) => r.relname);
    expect(unprotected).toEqual([]);
  });
});
