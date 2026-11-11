import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackingDeviceHealth } from "./tracking-device-health";
import type { DeviceHealth } from "./tracking-api";

const d = (over: Partial<DeviceHealth> = {}): DeviceHealth =>
  ({ userId: "u1", name: "Ravi", sessionStatus: "active", startedAt: "2026-09-14T09:00:00.000Z", endedAt: null,
     todayPoints: 100, lastRecordedAt: "2026-09-14T11:59:00.000Z", backgroundPermission: "granted",
     isLocationEnabled: true, batteryOptimizationStatus: "unrestricted", lowPowerMode: false, ...over } as DeviceHealth);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TrackingDeviceHealth", () => {
  it("renders the column headers and a row per device, worst-first", () => {
    render(<TrackingDeviceHealth devices={[d({ userId: "a", name: "Zara" }), d({ userId: "b", name: "Bala", isLocationEnabled: false })]} />);
    expect(screen.getByText("Coverage today")).toBeInTheDocument();
    const names = screen.getAllByText(/Zara|Bala/).map((n) => n.textContent);
    expect(names[0]).toBe("Bala"); // critical row sorts first
  });

  it("shows an empty message when there are no devices", () => {
    render(<TrackingDeviceHealth devices={[]} />);
    expect(screen.getByText("No tracked field staff.")).toBeInTheDocument();
  });
});
