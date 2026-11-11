import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { fetchAllOrders } from "./orders-export-fetch";
import type { Order } from "./orders-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) })) as Order[];
const path = (i = 0) => apiGet.mock.calls[i][1] as string;

afterEach(() => apiGet.mockReset());

describe("fetchAllOrders", () => {
  it("builds the query from every active filter (trimming search)", async () => {
    apiGet.mockResolvedValue({ orders: [], total: 0 });
    await fetchAllOrders(cfg, {
      fulfillment: "invoiced",
      search: "  widget ",
      city: "BLR",
      salesExecutiveId: "se1",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
    });
    const q = path();
    expect(q).toContain("sort=orderDate");
    expect(q).toContain("dir=desc");
    expect(q).toContain("pageSize=100");
    expect(q).toContain("fulfillment=invoiced");
    expect(q).toContain("search=widget");
    expect(q).toContain("city=BLR");
    expect(q).toContain("salesExecutiveId=se1");
    expect(q).toContain("dateFrom=2026-01-01");
    expect(q).toContain("dateTo=2026-02-01");
    expect(q).toContain("page=1");
  });

  it("omits the fulfillment param when 'all'", async () => {
    apiGet.mockResolvedValue({ orders: [], total: 0 });
    await fetchAllOrders(cfg, { fulfillment: "all" });
    expect(path()).not.toContain("fulfillment");
  });

  it("pages until the running total reaches the reported total", async () => {
    apiGet
      .mockResolvedValueOnce({ orders: rows(100), total: 150 })
      .mockResolvedValueOnce({ orders: rows(50), total: 150 });
    const all = await fetchAllOrders(cfg, { fulfillment: "all" });
    expect(all).toHaveLength(150);
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(path(1)).toContain("page=2");
  });

  it("stops on an empty page and tolerates a missing orders field", async () => {
    apiGet.mockResolvedValue({ total: 0 });
    const all = await fetchAllOrders(cfg, { fulfillment: "all" });
    expect(all).toHaveLength(0);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
