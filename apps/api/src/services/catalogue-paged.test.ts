import { describe, expect, test } from "vitest";
import type { SqlClient } from "../lib/db";
import { listManagedProductsPaged } from "./products";

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

const PCTX = { userId: "u1" } as Parameters<typeof listManagedProductsPaged>[1];

describe("listManagedProductsPaged (oils)", () => {
  test("returns mapped rows + total, default page size 8", async () => {
    const sql = fakeSql({
      list_managed_products_paged_count: () => [{ total: 65 }],
      list_managed_products_paged: () => [
        { id: "p1", productName: "Turbo 15W40", segments: ["Cars", "Commercial"], status: "active", createdAt: "2026-07-01T00:00:00Z" },
      ],
    });
    const res = await listManagedProductsPaged(sql, PCTX, {});
    expect(res.total).toBe(65);
    expect(res.pageSize).toBe(8);
    expect(res.rows[0]).toMatchObject({ id: "p1", productName: "Turbo 15W40", segments: ["Cars", "Commercial"], status: "active" });
    expect(sql.calls.list_managed_products_paged).toEqual([8, 0]);
  });

  test("binds %search% + limit/offset", async () => {
    const sql = fakeSql({ list_managed_products_paged_count: () => [{ total: 0 }], list_managed_products_paged: () => [] });
    await listManagedProductsPaged(sql, PCTX, { search: "turbo", page: 2, pageSize: 8 });
    expect(sql.calls.list_managed_products_paged_count).toEqual(["%turbo%"]);
    expect(sql.calls.list_managed_products_paged).toEqual(["%turbo%", 8, 8]);
  });
});
