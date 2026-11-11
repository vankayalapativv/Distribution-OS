import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { batterySummary, distanceSummary, EMPTY_POINTS, healthReasons, REFRESH_MS } from "./tracking-helpers";
import type { TrackedExecutive } from "./tracking-api";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive => ({ userId: "u1", ...over } as TrackedExecutive);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("constants", () => {
  it("exposes a stable empty points array and a 60s refresh", () => {
    expect(EMPTY_POINTS).toEqual([]);
    expect(REFRESH_MS).toBe(60_000);
  });
});

describe("batterySummary", () => {
  it("is null without a battery reading, else summarises it", () => {
    expect(batterySummary(ex())).toBeNull();
    const at = new Date(Date.now() - 3 * 60_000).toISOString();
    expect(batterySummary(ex({ batteryPercentage: 61.6, lastHeartbeatAt: at }))).toBe("Battery 62% · updated 3 min ago");
    // no heartbeat → "updated —"
    expect(batterySummary(ex({ batteryPercentage: 50 }))).toBe("Battery 50% · updated —");
  });
});

describe("healthReasons", () => {
  it("is empty when every permission is granted", () => {
    expect(healthReasons(ex({
      isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted",
      notificationPermission: "granted", batteryOptimizationStatus: "not_optimized", isConnected: true,
    }))).toEqual([]);
  });

  it("collects every degraded signal", () => {
    expect(healthReasons(ex())).toEqual([]);
    const reasons = healthReasons(ex({
      isLocationEnabled: false, foregroundPermission: "denied", backgroundPermission: "denied",
      notificationPermission: "denied", batteryOptimizationStatus: "optimized", isConnected: false,
    }));
    expect(reasons).toEqual([
      "GPS off", "Location permission missing", "Background permission missing",
      "Notifications off", "Battery optimized", "Network offline",
    ]);
  });
});

describe("distanceSummary", () => {
  it("is null without a distance, else formats total + quality", () => {
    expect(distanceSummary(ex())).toBeNull();
    expect(distanceSummary(ex({ totalDistanceKm: 42, acceptedDistancePointCount: 1, rejectedDistancePointCount: 0 }))).toEqual({
      total: "Total distance: 42 km", // integer → no decimal
      quality: "Calculated from 1 accepted point · 0 excluded", // singular
    });
    expect(distanceSummary(ex({ totalDistanceKm: 42.6, acceptedDistancePointCount: 3 }))?.total).toBe("Total distance: 42.6 km");
    // no accepted/rejected counts → default to 0 (and plural "points")
    expect(distanceSummary(ex({ totalDistanceKm: 5 }))?.quality).toBe("Calculated from 0 accepted points · 0 excluded");
  });

  it("shows the Start/End odometer readings in place of the point-count line", () => {
    // Day on, only a start reading → End is "—".
    expect(distanceSummary(ex({ totalDistanceKm: 0, startOdometer: 45200 }))?.quality).toBe(
      "Start 45,200 km · End —",
    );
    // Day ended → both readings, Indian grouping.
    expect(
      distanceSummary(ex({ totalDistanceKm: 100, startOdometer: 45200, endOdometer: 45300 }))?.quality,
    ).toBe("Start 45,200 km · End 45,300 km");
  });
});
