import { describe, expect, test } from "vitest";
import { buildStartDayHealthChecklist } from "./tracking-health";

describe("buildStartDayHealthChecklist", () => {
  test("marks the phone ready when core tracking health is good", () => {
    const health = buildStartDayHealthChecklist({
      isLocationEnabled: true,
      foregroundPermission: "granted",
      backgroundPermission: "granted",
      notificationPermission: "granted",
      batteryOptimizationStatus: "unrestricted",
      isConnected: true,
    });

    expect(health.canStart).toBe(true);
    expect(health.summary).toBe("Ready");
    expect(health.items.every((item) => item.status === "ok")).toBe(true);
  });

  test("blocks Start Day when GPS services are off", () => {
    const health = buildStartDayHealthChecklist({
      isLocationEnabled: false,
      foregroundPermission: "granted",
      backgroundPermission: "granted",
      notificationPermission: "granted",
      batteryOptimizationStatus: "unrestricted",
      isConnected: true,
    });

    expect(health.canStart).toBe(false);
    expect(health.summary).toBe("Action needed");
    expect(health.items.find((item) => item.id === "gps")?.status).toBe("blocker");
  });

  test("blocks Start Day when background 'Allow all the time' is denied", () => {
    const health = buildStartDayHealthChecklist({
      isLocationEnabled: true,
      foregroundPermission: "granted",
      backgroundPermission: "denied",
      notificationPermission: "denied",
      batteryOptimizationStatus: "optimized",
      isConnected: false,
    });

    // Background is essential (matches the enforced permissions.ts gate).
    expect(health.canStart).toBe(false);
    expect(health.summary).toBe("Action needed");
    expect(health.items.find((item) => item.id === "background_location")?.status).toBe("blocker");
    // The rest remain non-blocking warnings.
    expect(health.items.filter((item) => item.status === "warning").map((item) => item.id)).toEqual([
      "notifications",
      "battery",
      "network",
    ]);
  });
});
