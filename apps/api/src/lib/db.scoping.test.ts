import { describe, expect, it, vi } from "vitest";
import { createScopedSqlClient } from "./db";
import type { SqlClient } from "./db";

/**
 * Fake neon base client: the tagged template / query / unsafe return opaque
 * descriptor objects, and `.transaction` resolves to one result array per input
 * statement (so we can assert how many statements were sent and in what order).
 */
function fakeBase() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = (strings: TemplateStringsArray, ...values: any[]) => ({ kind: "tpl", strings, values });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.query = (text: string, params?: any[]) => ({ kind: "query", text, params });
  b.unsafe = (text: string) => ({ kind: "unsafe", text });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.transaction = vi.fn((arr: any[]) => Promise.resolve(arr.map((_, i) => [{ i }])));
  return b;
}

describe("createScopedSqlClient", () => {
  it("prefixes a standalone query with the 3 scope statements and returns the last result", async () => {
    const b = fakeBase();
    const sql = createScopedSqlClient(b as unknown as SqlClient, "ent-1", "user-1");

    const out = await sql`select 1`;

    expect(b.transaction).toHaveBeenCalledTimes(1);
    const sent = b.transaction.mock.calls[0][0];
    expect(sent).toHaveLength(4); // 3 scope + 1 user query
    // scope: SET LOCAL ROLE, set_config(enterprise_id), set_config(user_id)
    expect(sent[0].strings.join("?")).toMatch(/set local role app_tenant/i);
    expect(sent[1].values).toContain("ent-1");
    expect(sent[2].values).toContain("user-1");
    expect(sent[3]).toMatchObject({ kind: "tpl" }); // the user's query is last
    expect(out).toEqual([{ i: 3 }]); // last result of the 4
  });

  it("scopes sql.query the same way", async () => {
    const b = fakeBase();
    const sql = createScopedSqlClient(b as unknown as SqlClient, "ent-2");
    await sql.query("select 2");
    const sent = b.transaction.mock.calls[0][0];
    expect(sent).toHaveLength(4);
    expect(sent[1].values).toContain("ent-2");
    expect(sent[2].values).toContain(null); // no userId → null
    expect(sent[3]).toMatchObject({ kind: "query", text: "select 2" });
  });

  it("prepends scope to sql.transaction and strips the scope rows from the result", async () => {
    const b = fakeBase();
    const sql = createScopedSqlClient(b as unknown as SqlClient, "ent-3");
    const res = await sql.transaction([sql`a`, sql`b`]);
    const sent = b.transaction.mock.calls[0][0];
    expect(sent).toHaveLength(5); // 3 scope + 2 user
    expect(res).toHaveLength(2); // scope rows stripped
  });
});
