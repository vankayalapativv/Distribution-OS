import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useAdminTracking = vi.fn();
vi.mock("../../lib/use-admin-tracking", () => ({ useAdminTracking: () => useAdminTracking() }));
vi.mock("../../components/admin/tracking-date-stepper", () => ({ TrackingDateStepper: () => null }));
vi.mock("../../components/admin/tracking-map", () => ({ TrackingMap: () => null }));
vi.mock("../../components/admin/tracking-rep-strip", () => ({ TrackingRepStrip: () => null }));

import AdminTrackingScreen from "./tracking";

describe("AdminTrackingScreen", () => {
  it("renders the tracking header and map scaffold", () => {
    useAdminTracking.mockReturnValue({
      date: "2026-11-27", setDate: vi.fn(), loading: false, execs: [], selectedId: null,
      setSelectedId: vi.fn(), visible: true, route: [], routeStale: false, customers: [], bands: [], checkins: [],
    });
    render(<AdminTrackingScreen />);
    expect(screen.getByText("Tracking")).toBeInTheDocument();
  });
});
