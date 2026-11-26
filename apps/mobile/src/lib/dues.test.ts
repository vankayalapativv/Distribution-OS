import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDuesCustomers, fetchDuesSummary } from "./dues";
import { cacheKeys } from "./cache-keys";

const apiFetch = vi.fn();
const cachedFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
vi.mock("./read-cache", () => ({ cachedFetch: (...a: unknown[]) => cachedFetch(...a) }));

afterEach(() => vi.clearAllMocks());

describe("fetchDuesSummary", () => {
  it("reads through the cache and unwraps the summary", async () => {
    const summary = { bands: [], buckets: [], totalCustomers: 0, totalOutstanding: 0 };
    cachedFetch.mockImplementation(async (_k: string, fetcher: () => Promise<unknown>) => {
      await fetcher(); // exercise the inner apiFetch closure
      return { data: summary };
    });
    apiFetch.mockResolvedValue(summary);

    await expect(fetchDuesSummary()).resolves.toBe(summary);
    expect(cachedFetch).toHaveBeenCalledWith(cacheKeys.duesSummary, expect.any(Function));
    expect(apiFetch).toHaveBeenCalledWith("/dues/me/summary", { token: "tok" });
  });

  it("returns null when the fetch fails", async () => {
    cachedFetch.mockRejectedValue(new Error("offline"));
    await expect(fetchDuesSummary()).resolves.toBeNull();
  });
});

describe("fetchDuesCustomers", () => {
  it("reads the bucket cache key and calls the customers endpoint", async () => {
    const payload = { bucket: "2", customers: [] };
    cachedFetch.mockImplementation(async (_k: string, fetcher: () => Promise<unknown>) => {
      await fetcher();
      return { data: payload };
    });
    apiFetch.mockResolvedValue(payload);

    await expect(fetchDuesCustomers("2")).resolves.toBe(payload);
    expect(cachedFetch).toHaveBeenCalledWith(cacheKeys.duesBucket("2"), expect.any(Function));
    expect(apiFetch).toHaveBeenCalledWith("/dues/me/customers?bucket=2", { token: "tok" });
  });

  it("returns null when the drill-down fetch fails", async () => {
    cachedFetch.mockRejectedValue(new Error("offline"));
    await expect(fetchDuesCustomers("0")).resolves.toBeNull();
  });
});
