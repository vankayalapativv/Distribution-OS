import { describe, expect, it } from "vitest";
import { evaluateLocationHealth } from "./location-health";

const healthy = {
  isLocationEnabled: true,
  foregroundPermission: "granted",
  backgroundPermission: "granted",
} as const;

describe("evaluateLocationHealth", () => {
  it("returns null when everything is granted and GPS is on", () => {
    expect(evaluateLocationHealth(healthy)).toBeNull();
  });

  it("flags gps_off when device location services are off", () => {
    expect(evaluateLocationHealth({ ...healthy, isLocationEnabled: false })).toBe("gps_off");
  });

  it("flags foreground_denied when foreground permission is denied", () => {
    expect(evaluateLocationHealth({ ...healthy, foregroundPermission: "denied" })).toBe("foreground_denied");
  });

  it("flags background_denied when 'Allow all the time' is denied", () => {
    expect(evaluateLocationHealth({ ...healthy, backgroundPermission: "denied" })).toBe("background_denied");
  });

  it("reports the MOST fundamental problem first (gps > foreground > background)", () => {
    expect(
      evaluateLocationHealth({
        isLocationEnabled: false,
        foregroundPermission: "denied",
        backgroundPermission: "denied",
      }),
    ).toBe("gps_off");
    expect(
      evaluateLocationHealth({ ...healthy, foregroundPermission: "denied", backgroundPermission: "denied" }),
    ).toBe("foreground_denied");
  });

  it("does NOT block on UNKNOWN reads (avoids false lock-outs when a read fails)", () => {
    // null GPS state, or undetermined/unknown permissions, are not a definite denial.
    expect(evaluateLocationHealth({ ...healthy, isLocationEnabled: null })).toBeNull();
    expect(evaluateLocationHealth({ ...healthy, foregroundPermission: "unknown" })).toBeNull();
    expect(evaluateLocationHealth({ ...healthy, backgroundPermission: "undetermined" })).toBeNull();
  });
});
