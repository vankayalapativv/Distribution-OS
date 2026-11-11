import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TrackedExecutive } from "./tracking-api";

// Stateful URL mock: push/replace update the params + re-render subscribers, so
// the URL-driven view/date/selected-executive state works in these tests.
let sp = new URLSearchParams();
const listeners = new Set<() => void>();
const setUrl = (u: string) => {
  sp = new URLSearchParams(u.includes("?") ? u.slice(u.indexOf("?") + 1) : "");
  listeners.forEach((l) => l());
};
vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      listeners.add(force);
      return () => { listeners.delete(force); };
    }, []);
    return sp;
  },
  useRouter: () => ({ push: setUrl, replace: setUrl }),
  usePathname: () => "/tracking",
}));

import { TrackingView } from "./tracking-view";

describe("TrackingView", () => {
  beforeEach(() => { sp = new URLSearchParams(); });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("shows latest-known-location wording and API freshness labels", () => {
    vi.setSystemTime(new Date("2026-07-20T10:10:00.000Z"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        data: {
          executives: [],
          points: [],
        },
      }),
    );

    const executives = [
      {
        userId: "00000000-0000-4000-8000-000000000004",
        name: "Test Sales",
        sessionStatus: "active",
        startedAt: "2026-07-20T09:00:00.000Z",
        endedAt: null,
        pointCount: 8,
        lastLatitude: 17.249,
        lastLongitude: 80.153,
        lastAccuracyMeters: 8.2,
        lastRecordedAt: "2026-07-20T10:01:00.000Z",
        locationLabel: "Latest known location",
        trackingStatus: "gps_disabled",
        trackingStatusLabel: "GPS disabled",
      },
    ] as TrackedExecutive[];

    render(
      <TrackingView
        initialExecutives={executives}
        initialDate="2026-07-20"
        role="MANAGER"
        actionConfig={{ apiBaseUrl: "http://api.test", authToken: "token" }}
      />,
    );

    expect(screen.getByText("Latest known location")).toBeInTheDocument();
    expect(screen.getByText("GPS disabled")).toBeInTheDocument();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });

  test("shows battery age and heartbeat health reasons for the selected executive", () => {
    vi.setSystemTime(new Date("2026-07-20T10:10:00.000Z"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        data: {
          executives: [],
          points: [],
        },
      }),
    );

    const executives = [
      {
        userId: "00000000-0000-4000-8000-000000000004",
        name: "Test Sales",
        sessionStatus: "active",
        startedAt: "2026-07-20T09:00:00.000Z",
        endedAt: null,
        pointCount: 8,
        lastLatitude: 17.249,
        lastLongitude: 80.153,
        lastAccuracyMeters: 8.2,
        lastRecordedAt: "2026-07-20T10:01:00.000Z",
        locationLabel: "Latest known location",
        trackingStatus: "permission_missing",
        trackingStatusLabel: "Permission missing",
        lastHeartbeatAt: "2026-07-20T10:03:00.000Z",
        batteryPercentage: 62,
        isLocationEnabled: false,
        foregroundPermission: "denied",
        backgroundPermission: "denied",
        notificationPermission: "denied",
        batteryOptimizationStatus: "optimized",
        isConnected: false,
      },
    ] as TrackedExecutive[];

    render(
      <TrackingView
        initialExecutives={executives}
        initialDate="2026-07-20"
        role="MANAGER"
        actionConfig={{ apiBaseUrl: "http://api.test", authToken: "token" }}
      />,
    );

    expect(screen.getByText("Battery 62% · updated 7 min ago")).toBeInTheDocument();
    expect(screen.getByText("GPS off · Location permission missing · Background permission missing · Notifications off · Battery optimized · Network offline")).toBeInTheDocument();
  });

  test("shows filtered distance with accepted and excluded point counts", () => {
    vi.setSystemTime(new Date("2026-07-20T10:10:00.000Z"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        data: {
          executives: [],
          points: [],
        },
      }),
    );

    const executives = [
      {
        userId: "00000000-0000-4000-8000-000000000004",
        name: "Test Sales",
        sessionStatus: "active",
        startedAt: "2026-07-20T09:00:00.000Z",
        endedAt: null,
        pointCount: 230,
        lastLatitude: 17.249,
        lastLongitude: 80.153,
        lastAccuracyMeters: 8.2,
        lastRecordedAt: "2026-07-20T10:01:00.000Z",
        totalDistanceKm: 42.6,
        acceptedDistancePointCount: 218,
        rejectedDistancePointCount: 12,
      },
    ] as TrackedExecutive[];

    render(
      <TrackingView
        initialExecutives={executives}
        initialDate="2026-07-20"
        role="MANAGER"
        actionConfig={{ apiBaseUrl: "http://api.test", authToken: "token" }}
      />,
    );

    expect(screen.getByText("Total distance: 42.6 km")).toBeInTheDocument();
    expect(screen.getByText("Calculated from 218 accepted points · 12 excluded")).toBeInTheDocument();
  });

  test("switching to the Device health view fetches the device-health roster", async () => {
    vi.setSystemTime(new Date("2026-07-20T10:10:00.000Z"));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ success: true, data: { executives: [], points: [], devices: [] } }));

    render(
      <TrackingView
        initialExecutives={[]}
        initialDate="2026-07-20"
        role="MANAGER"
        actionConfig={{ apiBaseUrl: "http://api.test", authToken: "token" }}
      />,
    );

    fireEvent.click(screen.getByText("Device health"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/tracking/device-health"))).toBe(true),
    );
  });
});
