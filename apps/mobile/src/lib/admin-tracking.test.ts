import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCheckins, fetchExecutiveRoute, fetchMapCustomers, fetchTrackedExecutives,
  isLive, istToday, type TrackedExecutive,
} from "./admin-tracking";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
afterEach(() => vi.clearAllMocks());

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive => ({
  userId: "u1", name: "Asha", role: "SALES_EXECUTIVE", sessionStatus: "active",
  pointCount: 1, lastLatitude: 17, lastLongitude: 78, lastRecordedAt: null, ...over,
});

describe("istToday", () => {
  it("is an ISO date", () => { expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/); });
});

describe("fetchTrackedExecutives / fetchExecutiveRoute", () => {
  it("returns executives for the date, defaulting to []", async () => {
    apiFetch.mockResolvedValueOnce({ executives: [ex()] });
    expect((await fetchTrackedExecutives("2026-11-27")).length).toBe(1);
    apiFetch.mockResolvedValueOnce({});
    expect(await fetchTrackedExecutives("2026-11-27")).toEqual([]);
  });
  it("returns the route points, defaulting to []", async () => {
    apiFetch.mockResolvedValueOnce({ points: [{ latitude: 1, longitude: 2, recordedAt: "x" }] });
    expect((await fetchExecutiveRoute("u1", "2026-11-27")).length).toBe(1);
    apiFetch.mockResolvedValueOnce({});
    expect(await fetchExecutiveRoute("u1", "2026-11-27")).toEqual([]);
  });
});

describe("isLive", () => {
  it("is false without a last ping", () => { expect(isLive(ex({ lastRecordedAt: null }))).toBe(false); });
  it("is true for a recent ping", () => { expect(isLive(ex({ lastRecordedAt: new Date().toISOString() }))).toBe(true); });
  it("is false for a stale ping (>12 min)", () => {
    expect(isLive(ex({ lastRecordedAt: new Date(Date.now() - 13 * 60 * 1000).toISOString() }))).toBe(false);
  });
});

describe("fetchMapCustomers", () => {
  it("drops customers without coordinates and returns the bands", async () => {
    apiFetch.mockResolvedValue({
      customers: [{ id: "c1", lat: 17, lng: 78 }, { id: "c2", lat: null, lng: null }],
      bands: [{ key: "0", ordinal: 0 }],
    });
    const out = await fetchMapCustomers();
    expect(out.customers.map((c) => c.id)).toEqual(["c1"]);
    expect(out.bands).toHaveLength(1);
  });
  it("tolerates missing customers/bands", async () => {
    apiFetch.mockResolvedValue({});
    expect(await fetchMapCustomers()).toEqual({ customers: [], bands: [] });
  });
});

describe("fetchCheckins", () => {
  it("drops check-ins without coordinates, defaulting to []", async () => {
    apiFetch.mockResolvedValueOnce({ checkins: [{ visitId: "v1", lat: 1, lng: 2 }, { visitId: "v2", lat: null, lng: null }] });
    expect((await fetchCheckins("u1", "2026-11-27")).map((c) => c.visitId)).toEqual(["v1"]);
    apiFetch.mockResolvedValueOnce({});
    expect(await fetchCheckins("u1", "2026-11-27")).toEqual([]);
  });
});
