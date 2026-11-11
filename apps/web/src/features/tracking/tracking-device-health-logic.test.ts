import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ago, assess, coverage, sortDeviceRows } from "./tracking-device-health-logic";
import type { DeviceHealth } from "./tracking-api";

const d = (over: Partial<DeviceHealth> = {}): DeviceHealth =>
  ({
    userId: "u1", name: "Ravi", sessionStatus: "active",
    startedAt: "2026-09-14T09:00:00.000Z", endedAt: null, todayPoints: 100,
    lastRecordedAt: "2026-09-14T11:59:00.000Z", backgroundPermission: "granted",
    isLocationEnabled: true, batteryOptimizationStatus: "unrestricted", lowPowerMode: false, ...over,
  } as DeviceHealth);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("coverage", () => {
  it("is null without a start, else a capped percentage of expected pings", () => {
    expect(coverage(d({ startedAt: null }))).toBeNull();
    expect(coverage(d())).toBe(100); // 100 pings over 180 min (60 expected) → capped
    expect(coverage(d({ todayPoints: 30 }))).toBe(50); // 30/60
    expect(coverage(d({ endedAt: "2026-09-14T09:30:00.000Z", todayPoints: 5 }))).toBe(50); // 30 min → 10 expected
  });
});

describe("ago", () => {
  it("formats recency or a dash", () => {
    expect(ago(null)).toBe("—");
    expect(ago("2026-09-14T11:59:40.000Z")).toBe("just now");
    expect(ago("2026-09-14T11:40:00.000Z")).toBe("20 min ago");
    expect(ago("2026-09-14T09:30:00.000Z")).toBe("2h 30m ago");
  });
});

describe("assess", () => {
  it("is ok with no reasons for a healthy device", () => {
    expect(assess(d())).toEqual({ sev: "ok", reasons: [] });
  });

  it("flags critical signals", () => {
    expect(assess(d({ backgroundPermission: "denied" })).sev).toBe("crit");
    expect(assess(d({ isLocationEnabled: false })).sev).toBe("crit");
    expect(assess(d({ lastRecordedAt: "2026-09-14T11:30:00.000Z" })).sev).toBe("crit"); // 30 min stale, active
    expect(assess(d({ todayPoints: 0 })).sev).toBe("crit"); // active + no pings
  });

  it("flags warnings", () => {
    expect(assess(d({ batteryOptimizationStatus: "optimized" })).sev).toBe("warn");
    expect(assess(d({ lowPowerMode: true })).sev).toBe("warn");
    expect(assess(d({ todayPoints: 20 })).sev).toBe("warn"); // ~33% coverage < 70
    expect(assess(d({ sessionStatus: "ended", todayPoints: 0 })).sev).toBe("warn"); // inactive + no pings
  });

  it("collects the reason text", () => {
    expect(assess(d({ isLocationEnabled: false })).reasons).toContain("Location services off");
  });
});

describe("sortDeviceRows", () => {
  it("orders worst-first, then by name", () => {
    const rows = sortDeviceRows([
      d({ userId: "a", name: "Zara" }), // ok
      d({ userId: "b", name: "Bala", isLocationEnabled: false }), // crit
      d({ userId: "c", name: "Anil", lowPowerMode: true }), // warn
    ]);
    expect(rows.map((r) => r.d.name)).toEqual(["Bala", "Anil", "Zara"]);
  });

  it("breaks ties by name among equally-severe devices", () => {
    const rows = sortDeviceRows([d({ userId: "a", name: "Zara" }), d({ userId: "b", name: "Anil" })]);
    expect(rows.map((r) => r.d.name)).toEqual(["Anil", "Zara"]); // both ok → alphabetical
  });
});
