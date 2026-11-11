import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthHeaders = vi.fn(async () => ({ Authorization: "Bearer t" }));
const serverApiFetch = vi.fn();

vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => getApiAuthHeaders() }));
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));

import {
  listOrders,
  getOrder,
  listSalesExecutives,
  listProducts,
  getActionConfig,
} from "./orders-api";

const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const path = () => serverApiFetch.mock.calls[0][0] as string;

afterEach(() => {
  serverApiFetch.mockReset();
  getApiAuthHeaders.mockClear();
});

describe("listOrders", () => {
  it("fetches /orders with auth headers and no query when unfiltered", async () => {
    serverApiFetch.mockResolvedValue(ok({ orders: [{ id: "o1" }] }));
    expect(await listOrders()).toEqual([{ id: "o1" }]);
    expect(path()).toBe("/orders");
    expect(serverApiFetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: { Authorization: "Bearer t" } });
  });

  it("appends only the filters that are set", async () => {
    serverApiFetch.mockResolvedValue(ok({ orders: [] }));
    await listOrders({ status: "active", search: "widget", customerId: "", dateFrom: "2026-01-01" });
    const q = path();
    expect(q).toContain("status=active");
    expect(q).toContain("search=widget");
    expect(q).toContain("dateFrom=2026-01-01");
    expect(q).not.toContain("customerId");
    expect(q).not.toContain("salesExecutiveId");
  });

  it("throws with the status on a non-ok response", async () => {
    serverApiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(listOrders()).rejects.toThrow("Orders API failed with 500");
  });
});

describe("single-resource fetchers", () => {
  it("getOrder returns the order detail", async () => {
    serverApiFetch.mockResolvedValue(ok({ order: { id: "o1" } }));
    expect(await getOrder("o1")).toEqual({ id: "o1" });
    expect(path()).toBe("/orders/o1");
  });

  it("getOrder throws on failure", async () => {
    serverApiFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(getOrder("x")).rejects.toThrow("Order API failed with 404");
  });

  it("list endpoints unwrap their named payload", async () => {
    serverApiFetch.mockResolvedValueOnce(ok({ salesExecutives: [{ id: "s" }] }));
    expect(await listSalesExecutives()).toEqual([{ id: "s" }]);
    serverApiFetch.mockResolvedValueOnce(ok({ products: [{ id: "p" }] }));
    expect(await listProducts()).toEqual([{ id: "p" }]);
  });
});

describe("getActionConfig", () => {
  const original = process.env.SRI_APARAJITA_API_BASE_URL;
  beforeEach(() => {
    delete process.env.SRI_APARAJITA_API_BASE_URL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SRI_APARAJITA_API_BASE_URL;
    else process.env.SRI_APARAJITA_API_BASE_URL = original;
  });

  it("defaults to the localhost dev API", () => {
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });

  it("uses SRI_APARAJITA_API_BASE_URL when set", () => {
    process.env.SRI_APARAJITA_API_BASE_URL = "https://api.example/api/v1";
    expect(getActionConfig().apiBaseUrl).toBe("https://api.example/api/v1");
  });
});
