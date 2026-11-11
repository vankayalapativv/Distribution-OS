import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverApiFetch = vi.fn();
const getApiAuthHeaders = vi.fn(async () => ({ Authorization: "Bearer t" }));
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));
vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => getApiAuthHeaders() }));

import { getActionConfig, getCustomer, listCustomers } from "./customers-api";

const res = (ok: boolean, body: unknown, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

afterEach(() => serverApiFetch.mockReset());

describe("listCustomers", () => {
  it("builds a query string from all filters", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: [{ id: "c1" }] }));
    const out = await listCustomers({ status: "active", search: "ravi", customerGrade: "A" });
    const url = serverApiFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=active");
    expect(url).toContain("search=ravi");
    expect(url).toContain("customerGrade=A");
    expect(out).toEqual([{ id: "c1" }]);
  });

  it("omits the query string when no filters are given", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: [] }));
    await listCustomers();
    expect(serverApiFetch.mock.calls[0][0]).toBe("/customers");
  });

  it("throws when the response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}, 503));
    await expect(listCustomers()).rejects.toThrow("503");
  });
});

describe("getCustomer", () => {
  it("fetches one customer by id", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: { id: "c1" } }));
    expect(await getCustomer("c1")).toEqual({ id: "c1" });
    expect(serverApiFetch.mock.calls[0][0]).toBe("/customers/c1");
  });
  it("throws when the customer response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}, 404));
    await expect(getCustomer("nope")).rejects.toThrow("404");
  });
});

describe("getActionConfig", () => {
  const original = process.env.DISTRIBUTION_OS_API_BASE_URL;
  beforeEach(() => { delete process.env.DISTRIBUTION_OS_API_BASE_URL; });
  afterEach(() => { process.env.DISTRIBUTION_OS_API_BASE_URL = original; });

  it("uses the env var when set", () => {
    process.env.DISTRIBUTION_OS_API_BASE_URL = "https://api.example/v1";
    expect(getActionConfig().apiBaseUrl).toBe("https://api.example/v1");
  });
  it("falls back to the localhost dev URL", () => {
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
