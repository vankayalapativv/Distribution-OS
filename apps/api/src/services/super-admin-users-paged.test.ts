import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listSuperAdminUsersPaged } from "./super-admin-users-paged";

/** Fake Neon client matching queries by their `/* tag *\/` comment; records the
 * positional params passed to sql.query so we can assert filter/scope binding. */
function fakeSql(handlers: Record<string, (values: unknown[]) => unknown[]>) {
  const calls: Record<string, unknown[]> = {};
  const match = (text: string, values: unknown[]) => {
    for (const [tag, handler] of Object.entries(handlers)) {
      if (text.includes(`/* ${tag} */`)) {
        calls[tag] = values;
        return Promise.resolve(handler(values));
      }
    }
    return Promise.resolve([]);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = (strings: TemplateStringsArray, ...values: unknown[]) => match(strings.join(" "), values);
  fn.query = (text: string, params: unknown[] = []) => match(text, params);
  fn.calls = calls;
  return fn as SqlClient & { calls: Record<string, unknown[]> };
}

const COUNT = "super_admin_users_paged_count";
const ROWS = "super_admin_users_paged";

/** A fakeSql that also captures the rows-query SQL text, for ORDER BY assertions. */
function capturingSql() {
  const sql = fakeSql({ [COUNT]: () => [{ total: 0 }], [ROWS]: () => [] });
  let rowsText = "";
  const origQuery = sql.query.bind(sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sql as any).query = (text: string, params: unknown[] = []) => {
    if (text.includes(`/* ${ROWS} */`)) rowsText = text;
    return origQuery(text, params);
  };
  return { sql, orderBy: () => rowsText };
}

describe("listSuperAdminUsersPaged", () => {
  test("defaults: page size 8, no filters, maps rows + parses roles", async () => {
    const sql = fakeSql({
      [COUNT]: () => [{ total: 5 }],
      [ROWS]: () => [
        { id: "u1", name: "Asha", email: "asha@x.com", phone: "999", status: "active", appLoginId: "L1", roles: "MANAGER,SUPER_ADMIN" },
      ],
    });
    const res = await listSuperAdminUsersPaged(sql, {});
    expect(res).toMatchObject({ total: 5, page: 1, pageSize: 8 });
    expect(res.users[0]).toEqual({
      id: "u1", name: "Asha", email: "asha@x.com", phone: "999",
      status: "active", appLoginId: "L1", roles: ["MANAGER", "SUPER_ADMIN"],
    });
    expect(sql.calls[COUNT]).toEqual([]); // no filters bound
    expect(sql.calls[ROWS]).toEqual([8, 0]); // only limit + offset
  });

  test("binds status, role and %search% tokens, then limit/offset", async () => {
    const sql = fakeSql({ [COUNT]: () => [{ total: 0 }], [ROWS]: () => [] });
    await listSuperAdminUsersPaged(sql, {
      status: "active", role: "SALES_EXECUTIVE", search: "john doe", page: 2, pageSize: 8,
    });
    expect(sql.calls[COUNT]).toEqual(["active", "SALES_EXECUTIVE", "%john%", "%doe%"]);
    expect(sql.calls[ROWS]).toEqual(["active", "SALES_EXECUTIVE", "%john%", "%doe%", 8, 8]);
  });

  test("ignores an unknown status and an unknown role", async () => {
    const sql = fakeSql({ [COUNT]: () => [{ total: 0 }], [ROWS]: () => [] });
    await listSuperAdminUsersPaged(sql, { status: "banana", role: "WIZARD" });
    expect(sql.calls[COUNT]).toEqual([]); // neither filter bound
  });

  test("whitelists sort and clamps direction (invalid sort → name, non-asc → desc)", async () => {
    const a = capturingSql();
    await listSuperAdminUsersPaged(a.sql, { sort: "nope", dir: "ASC" });
    expect(a.orderBy()).toContain("order by u.name asc");

    const b = capturingSql();
    await listSuperAdminUsersPaged(b.sql, { sort: "status", dir: "garbage" });
    expect(b.orderBy()).toContain("order by u.status desc");
  });

  test("maps empty/missing fields: blank email → null, no roles → [], non-number total → 0", async () => {
    const sql = fakeSql({
      [COUNT]: () => [{ total: "x" }],
      [ROWS]: () => [
        { id: "u2", name: "Bala", email: "", phone: null, status: "inactive", appLoginId: null, roles: "" },
        { id: 7, name: 42, roles: "UNKNOWN,LOGISTICS" }, // odd types + an unknown role code
      ],
    });
    const res = await listSuperAdminUsersPaged(sql, {});
    expect(res.total).toBe(0);
    expect(res.users[0]).toMatchObject({ email: null, phone: null, roles: [] });
    // Non-string id/name coerce to "" (str's non-string branch); unknown role code dropped.
    expect(res.users[1]).toMatchObject({ id: "", name: "", email: null, roles: ["LOGISTICS"] });
  });
});
