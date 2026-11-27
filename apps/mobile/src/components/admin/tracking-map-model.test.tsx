import { describe, expect, it, vi } from "vitest";
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: { getState: () => ({ token: "t" }) } }));

import {
  buildCheckinMarkers,
  buildCustomerMarkers,
  buildRepMarkers,
  buildRoutes,
  computeFitKey,
  coordKey,
  markerColor,
} from "./tracking-map-model";
import { resolveMarkerTap } from "./tracking-map-tap";

const rep = (over: Record<string, unknown> = {}) =>
  ({ userId: "u1", name: "Asha", lastLatitude: 17.4, lastLongitude: 78.5, live: true, ...over }) as never;
const cust = (over: Record<string, unknown> = {}) =>
  ({ id: "c1", name: "Acme", lat: 17.1, lng: 78.1, bucket: null, ...over }) as never;
const ci = (over: Record<string, unknown> = {}) =>
  ({ id: "k1", customerName: "Acme", lat: 17.2, lng: 78.2, planned: "planned", orders: [], collections: [], ...over }) as never;

describe("tracking-map-model", () => {
  it("coordKey + markerColor", () => {
    expect(coordKey(1, 2)).toBe("1,2");
    expect(markerColor(true)).not.toBe(markerColor(false));
  });

  it("builds rep / customer / check-in markers with the right radii", () => {
    expect(buildRepMarkers([rep()])[0].radius).toBe(7);
    expect(buildCustomerMarkers([cust()])[0].radius).toBe(6);
    const planned = buildCheckinMarkers([ci({ planned: "planned" })]);
    const unplanned = buildCheckinMarkers([ci({ planned: "unplanned" })]);
    expect(planned[0].radius).toBe(9);
    expect(planned[0].color).not.toBe(unplanned[0].color); // planned vs unplanned tint
  });

  it("buildRoutes: ready trail, fly-target, then empty", () => {
    const route = [
      { latitude: 17.1, longitude: 78.1, recordedAt: "2026-11-27T04:00:00Z" },
      { latitude: 17.2, longitude: 78.2, recordedAt: "2026-11-27T04:05:00Z" },
    ] as never[];
    expect(buildRoutes(true, route, rep()) [0].showPoints).toBe(true);
    expect(buildRoutes(false, [], rep())[0].weight).toBe(0); // invisible fly-target
    expect(buildRoutes(false, [], rep({ lastLatitude: null }))).toEqual([]);
  });

  it("computeFitKey prefers route, then selection, then all markers, then none", () => {
    const route = [{ latitude: 1, longitude: 2, recordedAt: "T0" }] as never[];
    expect(computeFitKey(true, route, "u1", 3)).toBe("r:T0");
    expect(computeFitKey(false, [], "u1", 3)).toBe("s:u1");
    expect(computeFitKey(false, [], null, 3)).toBe("all:3");
    expect(computeFitKey(false, [], null, 0)).toBeUndefined();
  });
});

describe("resolveMarkerTap", () => {
  const byCi = new Map([[coordKey(17.2, 78.2), ci()]]);
  const byCu = new Map([[coordKey(17.1, 78.1), cust()]]);
  const visible = [rep()];

  it("prefers a check-in, then a rep, then a customer, then none", () => {
    expect(resolveMarkerTap({ lat: 17.2, lng: 78.2 } as never, byCi, visible, byCu)?.kind).toBe("checkin");
    expect(resolveMarkerTap({ lat: 17.4, lng: 78.5 } as never, byCi, visible, byCu)).toEqual({ kind: "rep", userId: "u1" });
    expect(resolveMarkerTap({ lat: 17.1, lng: 78.1 } as never, byCi, visible, byCu)?.kind).toBe("customer");
    expect(resolveMarkerTap({ lat: 0, lng: 0 } as never, byCi, visible, byCu)).toBeNull();
  });
});
