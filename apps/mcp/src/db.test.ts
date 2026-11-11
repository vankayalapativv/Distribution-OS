import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The scoping contract for run_sql — the heart of Phase 4 isolation.
 *
 * Every query MUST run inside one transaction that (1) drops to app_readonly so
 * RLS applies and (2) pins app.enterprise_id to the caller's enterprise. Without
 * the role switch the owner connection would bypass RLS and read every tenant, so
 * these assertions are a real security guard, not cosmetics.
 */
const neon = vi.fn();
vi.mock("@neondatabase/serverless", () => ({ neon: (...a: unknown[]) => neon(...a) }));

import { resolveEnterpriseByPassphrase, runReadOnlySql, sha256Hex } from "./db";

afterEach(() => vi.clearAllMocks());

/** A fake neon client that records tagged-template text + the transaction batch. */
function fakeClient(lastRows: Record<string, unknown>[]) {
  const calls: string[] = [];
  const tag = (strings: TemplateStringsArray, ...vals: unknown[]) => {
    calls.push(strings.join("?"));
    return { __q: strings.join("?"), vals };
  };
  (tag as unknown as { query: (t: string) => unknown }).query = (t: string) => {
    calls.push(`QUERY:${t}`);
    return { __q: t };
  };
  (tag as unknown as { transaction: (s: unknown[]) => Promise<unknown[]> }).transaction = async (stmts) => {
    // Return one result array per statement; the LAST is the user query's rows.
    return stmts.map((_, i) => (i === stmts.length - 1 ? lastRows : []));
  };
  return { client: tag, calls };
}

describe("runReadOnlySql scoping", () => {
  it("wraps the query in SET LOCAL ROLE app_readonly + app.enterprise_id, returns the last result", async () => {
    const { client, calls } = fakeClient([{ id: "c1" }, { id: "c2" }]);
    neon.mockReturnValue(client);

    const out = await runReadOnlySql("postgres://x", "ent-42", "select * from customers");

    const batch = calls.join("\n").toLowerCase();
    expect(batch).toContain("set local role app_readonly");
    expect(batch).toContain("set_config('app.enterprise_id'"); // enterprise pinned
    expect(batch).toContain("query:select * from customers"); // user query is last
    expect(out.rows).toEqual([{ id: "c1" }, { id: "c2" }]);
    expect(out.rowCount).toBe(2);
    expect(out.columns).toEqual(["id"]);
  });
});

describe("sha256Hex", () => {
  it("is a stable 64-char lowercase hex digest", async () => {
    const h = await sha256Hex("hunter2");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("hunter2")).toBe(h); // deterministic
    expect(await sha256Hex("hunter3")).not.toBe(h);
  });
});

describe("resolveEnterpriseByPassphrase", () => {
  it("hashes the passphrase and returns the resolver's enterprise_id", async () => {
    let seenHash = "";
    const client = (strings: TemplateStringsArray, ...vals: unknown[]) => {
      seenHash = String(vals[0]);
      return Promise.resolve([{ eid: "ent-9" }]);
    };
    neon.mockReturnValue(client);
    const eid = await resolveEnterpriseByPassphrase("postgres://x", "s3cret-pass");
    expect(eid).toBe("ent-9");
    expect(seenHash).toBe(await sha256Hex("s3cret-pass")); // looked up by SHA-256, not plaintext
  });

  it("returns null when no enterprise matches", async () => {
    neon.mockReturnValue(() => Promise.resolve([{ eid: null }]));
    expect(await resolveEnterpriseByPassphrase("postgres://x", "nope")).toBeNull();
  });
});
