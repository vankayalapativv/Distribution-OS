import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackingExecutiveDetail } from "./tracking-executive-detail";
import type { TrackedExecutive } from "./tracking-api";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive =>
  ({ userId: "u1", name: "Ravi", pointCount: 8, startedAt: "2026-09-14T03:30:00.000Z", endedAt: null,
     lastRecordedAt: "2026-09-14T11:59:00.000Z", ...over } as TrackedExecutive);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TrackingExecutiveDetail", () => {
  it("shows battery, health reasons and distance when present", () => {
    render(
      <TrackingExecutiveDetail
        selected={ex({
          batteryPercentage: 62, lastHeartbeatAt: "2026-09-14T11:57:00.000Z",
          isLocationEnabled: false, totalDistanceKm: 42.6, acceptedDistancePointCount: 218, rejectedDistancePointCount: 12,
        })}
        routePointCount={5}
      />,
    );
    expect(screen.getByText(/Battery 62%/)).toBeInTheDocument();
    expect(screen.getByText("GPS off")).toBeInTheDocument();
    expect(screen.getByText("Total distance: 42.6 km")).toBeInTheDocument();
    expect(screen.getByText(/Route shown: 5 points/)).toBeInTheDocument();
    expect(screen.getByText(/still on/)).toBeInTheDocument();
  });

  it("omits battery/health/distance when absent and shows the end time + singular route", () => {
    render(<TrackingExecutiveDetail selected={ex({ endedAt: "2026-09-14T13:00:00.000Z" })} routePointCount={1} />);
    expect(screen.queryByText(/Battery/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total distance/)).not.toBeInTheDocument();
    expect(screen.getByText(/ended/)).toBeInTheDocument();
    expect(screen.getByText(/Route shown: 1 point$/)).toBeInTheDocument();
  });
});
