import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMyPerformance, segLitres, sumLitres, type MyPerformance } from "./performance";
import { cacheKeys } from "./cache-keys";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const cachedFetch = vi.fn<(...a: unknown[]) => Promise<{ data: unknown }>>(() => Promise.resolve({ data: null }));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
vi.mock("./read-cache", () => ({ cachedFetch: (...a: unknown[]) => cachedFetch(...a) }));

afterEach(() => vi.clearAllMocks());

describe("sumLitres", () => {
  it("returns 0 for null/undefined/non-array", () => {
    expect(sumLitres(null)).toBe(0);
    expect(sumLitres(undefined)).toBe(0);
    expect(sumLitres("x" as unknown as [])).toBe(0);
  });
  it("sums litres, treating a missing litres as 0", () => {
    expect(sumLitres([{ segment: "Car", litres: 3 }, { segment: "2W", litres: 2 }])).toBe(5);
    expect(sumLitres([{ segment: "Car" } as unknown as { segment: string; litres: number }])).toBe(0);
  });
});

describe("segLitres", () => {
  const segs = [{ segment: "Car", litres: 4 }, { segment: "2W", litres: 1 }];
  it("returns the matching segment's litres", () => {
    expect(segLitres(segs, "Car")).toBe(4);
  });
  it("returns 0 for a missing segment or a non-array", () => {
    expect(segLitres(segs, "Gear Oil")).toBe(0);
    expect(segLitres(null, "Car")).toBe(0);
  });
});

describe("fetchMyPerformance", () => {
  it("returns the read-through cached payload and fetches /targets/me", async () => {
    const perf = { today: { date: "2026-11-27" } } as MyPerformance;
    cachedFetch.mockResolvedValue({ data: perf });
    expect(await fetchMyPerformance()).toBe(perf);
    expect(cachedFetch).toHaveBeenCalledWith(cacheKeys.performance, expect.any(Function));
    // the fetcher hits /targets/me with the auth token
    await (cachedFetch.mock.calls[0][1] as () => Promise<unknown>)();
    expect(apiFetch).toHaveBeenCalledWith("/targets/me", { token: "tok" });
  });
  it("returns null when the fetch fails and there is no cache", async () => {
    cachedFetch.mockRejectedValue(new Error("offline"));
    expect(await fetchMyPerformance()).toBeNull();
  });
});
