import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackingDeviceHealthRow } from "./tracking-device-health-row";
import type { DeviceHealth } from "./tracking-api";
import type { DeviceRow } from "./tracking-device-health-logic";

const d = (over: Partial<DeviceHealth> = {}): DeviceHealth =>
  ({ userId: "u1", name: "Ravi", sessionStatus: "active", startedAt: "2026-09-14T09:00:00.000Z", endedAt: null,
     todayPoints: 100, lastRecordedAt: "2026-09-14T11:59:00.000Z", backgroundPermission: "granted",
     isLocationEnabled: true, batteryOptimizationStatus: "unrestricted", lowPowerMode: false, ...over } as DeviceHealth);
const row = (over: Partial<DeviceHealth> = {}, extra: Partial<DeviceRow> = {}): DeviceRow =>
  ({ d: d(over), sev: "ok", reasons: [], ...extra });

const wrap = (r: DeviceRow) => render(<table><tbody><TrackingDeviceHealthRow row={r} /></tbody></table>);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TrackingDeviceHealthRow", () => {
  it("shows name, device info, pings and battery", () => {
    wrap(row({ manufacturer: "Samsung", model: "A14", androidVersion: "14", appVersion: "2.1.0", batteryPercentage: 62, networkType: "wifi" }));
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText(/Samsung A14/)).toBeInTheDocument();
    expect(screen.getByText(/An14/)).toBeInTheDocument();
    expect(screen.getByText(/app 2.1.0/)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("wifi")).toBeInTheDocument();
  });

  it("shows reasons and a low-power flag, dashes missing device + battery", () => {
    wrap(row({ lowPowerMode: true, manufacturer: null, model: null, batteryPercentage: null }, { sev: "crit", reasons: ["Location services off"] }));
    expect(screen.getByText("Location services off")).toBeInTheDocument();
    expect(screen.getByText("Low power")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("marks low coverage amber", () => {
    wrap(row({ todayPoints: 20 })); // ~33% < 70
    expect(screen.getByText(/33%/).className).toMatch(/amber/);
  });

  it("shows a model even when the manufacturer is missing", () => {
    wrap(row({ manufacturer: null, model: "Pixel 7" }));
    expect(screen.getByText("Pixel 7")).toBeInTheDocument();
  });
});
