import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listOrdersPaged } from "./orders";

/** Fake Neon client: matches queries by their `/* tag *\/` comment and records
 * the positional params passed to sql.query. */
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

const CTX = { userId: "u1" } as Parameters<typeof listOrdersPaged>[1];

describe("listOrdersPaged", () => {
  test("returns mapped rows + total + paging (default page size 8)", async () => {
    const sql = fakeSql({
      list_orders_paged_count: () => [{ total: 20 }],
      list_orders_paged: () => [
        {
          id: "o1", orderCode: "ORD-1", orderDate: new Date("2026-07-20T00:00:00Z"),
          customerName: "Sri Balaji", orderStatus: "confirmed", totalLitres: "40",
        },
      ],
    });
    const res = await listOrdersPaged(sql, CTX, {});
    expect(res.total).toBe(20);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(8);
    expect(res.rows[0]).toMatchObject({ id: "o1", orderCode: "ORD-1", orderStatus: "confirmed" });
    expect(sql.calls.list_orders_paged).toEqual([8, 0]); // no filters, just limit+offset
  });

  test("binds all filters (status, customer, sales-exec, date range, search) + limit/offset", async () => {
    const sql = fakeSql({ list_orders_paged_count: () => [{ total: 0 }], list_orders_paged: () => [] });
    await listOrdersPaged(sql, CTX, {
      status: "confirmed",
      customerId: "cust-1",
      salesExecutiveId: "se-1",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      search: "balaji",
      page: 3,
      pageSize: 8,
    });
    const filters = ["confirmed", "cust-1", "se-1", "2026-07-01", "2026-07-31", "%balaji%"];
    expect(sql.calls.list_orders_paged_count).toEqual(filters);
    expect(sql.calls.list_orders_paged).toEqual([...filters, 8, 16]); // page 3 → offset 16
  });

  test("no filters → count query has no params", async () => {
    const sql = fakeSql({ list_orders_paged_count: () => [{ total: 0 }], list_orders_paged: () => [] });
    await listOrdersPaged(sql, CTX, { search: "  " });
    expect(sql.calls.list_orders_paged_count).toEqual([]);
  });
});
