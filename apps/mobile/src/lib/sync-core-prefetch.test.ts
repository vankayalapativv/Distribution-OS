import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefetchReadData } from "./sync-core-prefetch";
import { cacheKeys } from "./cache-keys";

const apiFetch = vi.fn();
const fetchSeCustomers = vi.fn<(...a: unknown[]) => Promise<unknown[]>>(() => Promise.resolve([]));
const fetchMyPerformance = vi.fn(() => Promise.resolve(null));
const fetchTodayBeat = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
const fetchNotifications = vi.fn<(...a: unknown[]) => Promise<unknown[]>>(() => Promise.resolve([]));
const fetchOils = vi.fn<(...a: unknown[]) => Promise<unknown[]>>(() => Promise.resolve([]));
const fetchDuesSummary = vi.fn<() => Promise<unknown>>(() => Promise.resolve({ buckets: [{ key: "0" }, { key: "1" }] }));
const fetchDuesCustomers = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
const getIsOnline = vi.fn(() => true);
const shouldPrefetch = vi.fn<(...a: unknown[]) => boolean>(() => true);
const writeCache = vi.fn();
const cachedFetch = vi.fn((_k: string, fetcher: () => unknown) => { fetcher(); return Promise.resolve({ data: {}, fromCache: false }); });
let authState: { token: string | null; user: { role: string } | null } = { token: "tok", user: { role: "SALES_EXECUTIVE" } };

vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => authState } }));
vi.mock("./beat/today-beat-online", () => ({ fetchTodayBeat: (...a: unknown[]) => fetchTodayBeat(...a) }));
vi.mock("./customer-directory", () => ({ fetchSeCustomers: (...a: unknown[]) => fetchSeCustomers(...a) }));
vi.mock("./dues", () => ({ fetchDuesSummary: () => fetchDuesSummary(), fetchDuesCustomers: (...a: unknown[]) => fetchDuesCustomers(...a) }));
vi.mock("./connectivity", () => ({ getIsOnline: () => getIsOnline() }));
vi.mock("./invoice-notifications", () => ({ fetchNotifications: (...a: unknown[]) => fetchNotifications(...a) }));
vi.mock("./order/api", () => ({ fetchOils: (...a: unknown[]) => fetchOils(...a) }));
vi.mock("./performance", () => ({ fetchMyPerformance: () => fetchMyPerformance() }));
vi.mock("./prefetch-throttle", () => ({ shouldPrefetch: (...a: unknown[]) => shouldPrefetch(...a) }));
vi.mock("./read-cache", () => ({ cachedFetch: (...a: unknown[]) => cachedFetch(...(a as [string, () => unknown])), writeCache: (...a: unknown[]) => writeCache(...a) }));

beforeEach(() => {
  authState = { token: "tok", user: { role: "SALES_EXECUTIVE" } };
  getIsOnline.mockReturnValue(true);
  shouldPrefetch.mockReturnValue(true);
  fetchDuesSummary.mockResolvedValue({ buckets: [{ key: "0" }, { key: "1" }] });
  apiFetch.mockImplementation((path: string) => {
    if (path === "/customers/ledgers/bulk") return Promise.resolve({ ledgers: [{ customerId: "c1", ledger: { x: 1 } }] });
    if (path === "/orders/recent-bulk") {
      const six = Array.from({ length: 6 }, (_, i) => ({ customerId: "c1", id: i }));
      return Promise.resolve({ orders: [...six, { id: "no-cust" }] });
    }
    return Promise.resolve({});
  });
});
afterEach(() => vi.clearAllMocks());

describe("prefetchReadData — guards", () => {
  it("skips without a token / user / online / throttle", async () => {
    authState = { token: null, user: null };
    await prefetchReadData();
    authState = { token: "tok", user: { role: "SALES_EXECUTIVE" } };
    getIsOnline.mockReturnValue(false);
    await prefetchReadData();
    getIsOnline.mockReturnValue(true);
    shouldPrefetch.mockReturnValue(false);
    await prefetchReadData();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(fetchSeCustomers).not.toHaveBeenCalled();
  });
});

describe("prefetchReadData — SALES_EXECUTIVE", () => {
  it("warms every SE cache slot, dues bands, ledgers and capped recent orders", async () => {
    await prefetchReadData();
    expect(fetchSeCustomers).toHaveBeenCalledWith("tok");
    expect(fetchMyPerformance).toHaveBeenCalled();
    expect(fetchTodayBeat).toHaveBeenCalledWith("tok");
    expect(fetchDuesCustomers).toHaveBeenCalledWith("0");
    expect(fetchDuesCustomers).toHaveBeenCalledWith("1");
    expect(writeCache).toHaveBeenCalledWith(cacheKeys.ledger("c1"), { x: 1 });
    // recent orders grouped + capped at 5 per customer; the id-less order dropped
    const call = writeCache.mock.calls.find((c) => c[0] === cacheKeys.customerOrders("c1"))!;
    expect((call[1] as unknown[]).length).toBe(5);
  });

  it("skips dues customer fetches when the summary is unavailable", async () => {
    fetchDuesSummary.mockResolvedValue(null);
    await prefetchReadData();
    expect(fetchDuesCustomers).not.toHaveBeenCalled();
  });

  it("swallows a failing job so one bad endpoint never aborts the batch", async () => {
    fetchMyPerformance.mockRejectedValue(new Error("perf down"));
    await expect(prefetchReadData()).resolves.toBeUndefined();
  });
});

describe("prefetchReadData — other roles", () => {
  it("prefetches nothing for a role without a cache profile (e.g. SUPER_ADMIN)", async () => {
    authState = { token: "tok", user: { role: "SUPER_ADMIN" } };
    await prefetchReadData();
    expect(fetchSeCustomers).not.toHaveBeenCalled();
    expect(fetchNotifications).not.toHaveBeenCalled();
  });
});

describe("prefetchReadData — LOGISTICS", () => {
  it("warms only notifications + pending invoices", async () => {
    authState = { token: "tok", user: { role: "LOGISTICS" } };
    await prefetchReadData();
    expect(fetchNotifications).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledWith("/deliveries/pending-invoices", { token: "tok" });
    expect(fetchSeCustomers).not.toHaveBeenCalled();
  });
});
