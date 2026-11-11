import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listCustomersPaged } from "./customers";

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

type Ctx = Parameters<typeof listCustomersPaged>[1];
const OFFICE = { userId: "u-admin", role: "MANAGER" } as Ctx;
const SE = { userId: "se-1", role: "SALES_EXECUTIVE" } as Ctx;

describe("listCustomersPaged", () => {
  test("returns mapped rows + total + paging (defaults to page size 8)", async () => {
    const sql = fakeSql({
      list_customers_paged_count: () => [{ total: 12 }],
      list_customers_paged: () => [
        { id: "c1", customerCode: "CUS-1", legalName: "Sri Balaji", customerType: "retailer", status: "active", creditLimit: "5000" },
      ],
    });
    const res = await listCustomersPaged(sql, OFFICE, {});
    expect(res.total).toBe(12);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(8);
    expect(res.rows[0]).toMatchObject({ id: "c1", customerCode: "CUS-1", legalName: "Sri Balaji", creditLimit: 5000 });
    // rows query bound only limit + offset (no filters)
    expect(sql.calls.list_customers_paged).toEqual([8, 0]);
  });

  test("binds status, %search% (across name/code) and limit/offset", async () => {
    const sql = fakeSql({ list_customers_paged_count: () => [{ total: 0 }], list_customers_paged: () => [] });
    await listCustomersPaged(sql, OFFICE, { status: "active", search: "balaji", page: 2, pageSize: 8 });
    // filter params reused by both count and rows; rows adds limit+offset
    expect(sql.calls.list_customers_paged_count).toEqual(["active", "%balaji%"]);
    expect(sql.calls.list_customers_paged).toEqual(["active", "%balaji%", 8, 8]);
  });

  test("SALES_EXECUTIVE is scoped to their own created_by", async () => {
    const sql = fakeSql({ list_customers_paged_count: () => [{ total: 0 }], list_customers_paged: () => [] });
    await listCustomersPaged(sql, SE, { search: "x" });
    // created_by scope param comes before the search pattern
    expect(sql.calls.list_customers_paged_count).toEqual(["se-1", "%x%"]);
  });

  test("office roles are NOT scoped by created_by", async () => {
    const sql = fakeSql({ list_customers_paged_count: () => [{ total: 0 }], list_customers_paged: () => [] });
    await listCustomersPaged(sql, OFFICE, {});
    expect(sql.calls.list_customers_paged_count).toEqual([]); // no filters at all
  });
});
