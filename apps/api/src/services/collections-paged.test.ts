import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listCollectionsPaged } from "./collections";

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

const CTX = { userId: "u1" } as Parameters<typeof listCollectionsPaged>[1];

describe("listCollectionsPaged", () => {
  test("returns mapped rows + total, default page size 8", async () => {
    const sql = fakeSql({
      list_collections_paged_count: () => [{ total: 30 }],
      list_collections_paged: () => [
        {
          id: "col1", collectionCode: "COL-1", collectionDate: new Date("2026-07-20T00:00:00Z"),
          customerName: "Sri Balaji", paymentMode: "cash", collectionAmount: "5000",
          accountantApprovalStatus: "pending", matchedStatus: "unmatched",
        },
      ],
    });
    const res = await listCollectionsPaged(sql, CTX, {});
    expect(res.total).toBe(30);
    expect(res.pageSize).toBe(8);
    expect(res.rows[0]).toMatchObject({ id: "col1", collectionCode: "COL-1", accountantApprovalStatus: "pending" });
    expect(sql.calls.list_collections_paged).toEqual([8, 0]);
  });

  test("binds status + %search% + date range + limit/offset", async () => {
    const sql = fakeSql({ list_collections_paged_count: () => [{ total: 0 }], list_collections_paged: () => [] });
    await listCollectionsPaged(sql, CTX, {
      status: "verified",
      search: "balaji",
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
      page: 2,
      pageSize: 8,
    });
    const filters = ["verified", "2026-07-01", "2026-07-31", "%balaji%"];
    expect(sql.calls.list_collections_paged_count).toEqual(filters);
    expect(sql.calls.list_collections_paged).toEqual([...filters, 8, 8]);
  });

  test("status 'all'/blank applies no status filter", async () => {
    const sql = fakeSql({ list_collections_paged_count: () => [{ total: 0 }], list_collections_paged: () => [] });
    await listCollectionsPaged(sql, CTX, { status: "" });
    expect(sql.calls.list_collections_paged_count).toEqual([]);
  });
});
