import { describe, expect, it } from "vitest";
import { buildRoutes, execForMarker, execMarkers, fitKeyOf } from "./tracking-map-model";
import type { RoutePoint, TrackedExecutive } from "./tracking-api";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive =>
  ({ userId: "u1", name: "Ravi", lastLatitude: 17.2, lastLongitude: 80.1, trackingStatus: "fresh", ...over } as TrackedExecutive);
const pts: RoutePoint[] = [
  { latitude: 17.1, longitude: 80.0, accuracyMeters: 5, recordedAt: "2026-09-14T09:00:00.000Z" },
  { latitude: 17.2, longitude: 80.1, accuracyMeters: 5, recordedAt: "2026-09-14T09:05:00.000Z" },
];

describe("execMarkers", () => {
  it("drops executives without coordinates and colours by freshness", () => {
    const markers = execMarkers([ex(), ex({ userId: "u2", trackingStatus: "delayed" }), ex({ userId: "u3", lastLatitude: null })]);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ lat: 17.2, lng: 80.1, label: "Ravi", permanent: true, color: "#16a34a", radius: 7 });
    expect(markers[1].color).toBe("#9ca3af"); // delayed → grey
  });
});

describe("buildRoutes", () => {
  it("returns a receding slate trail with white slate-ringed bead pings when ready", () => {
    const [route] = buildRoutes(pts, true);
    expect(route.color).toBe("#94a3b8"); // slate-400 line (not saturated blue)
    expect(route.showPoints).toBe(true);
    expect(route.pointFillColor).toBe("#ffffff"); // white bead
    expect(route.pointBorderColor).toBe("#475569"); // slate ring
    expect(route.pointBorderWeight).toBeGreaterThan(0);
    expect(route.points).toHaveLength(2);
    expect(route.points[0].label).toMatch(/\d/); // formatted IST time
  });

  it("returns an invisible fly-target at the selected exec when not ready", () => {
    const [route] = buildRoutes(pts, false, ex());
    expect(route.color).toBe("transparent");
    expect(route.points).toEqual([{ lat: 17.2, lng: 80.1 }, { lat: 17.2, lng: 80.1 }]);
  });

  it("returns nothing when not ready and no selection", () => {
    expect(buildRoutes(pts, false, undefined)).toEqual([]);
  });
});

describe("fitKeyOf", () => {
  it("keys on the first ping when ready, else the selection", () => {
    expect(fitKeyOf(true, pts, "u1")).toBe("r:2026-09-14T09:00:00.000Z");
    expect(fitKeyOf(false, pts, "u1")).toBe("s:u1");
    expect(fitKeyOf(false, pts, null)).toBe("s:none");
  });
});

describe("execForMarker", () => {
  it("finds the executive at a position marker, ignoring flags and dots", () => {
    const execs = [ex()];
    expect(execForMarker(execs, { lat: 17.2, lng: 80.1 })?.userId).toBe("u1");
    expect(execForMarker(execs, { lat: 0, lng: 0 })).toBeUndefined();
    expect(execForMarker(execs, { lat: 17.2, lng: 80.1, icon: "flag" } as never)).toBeUndefined();
  });
});
