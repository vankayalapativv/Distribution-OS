import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./tracking-header", () => ({ TrackingHeader: () => <div data-testid="header" /> }));
vi.mock("./tracking-executive-list", () => ({ TrackingExecutiveList: () => <div data-testid="exec-list" /> }));
vi.mock("./tracking-device-health", () => ({ TrackingDeviceHealth: () => <div data-testid="device-health" /> }));

const hook = {
  date: "2026-09-14", setDate: vi.fn(), selectedUserId: null, setSelectedUserId: vi.fn(),
  view: "map" as "map" | "health", setView: vi.fn(),
  executives: [], effectiveSelectedUserId: null, routePoints: [], routeStale: false,
  checkins: [], customers: [], customerDistricts: [], deviceHealth: [], lastUpdated: null,
  displayError: null as string | null, refetch: vi.fn(),
};
vi.mock("./use-tracking-data", () => ({ useTrackingData: () => hook }));

import { TrackingView } from "./tracking-view";
import type { TrackingRole } from "./tracking-view";

const props = { initialExecutives: [], initialDate: "2026-09-14", role: "MANAGER" as TrackingRole, actionConfig: { apiBaseUrl: "", authToken: "" } };

describe("TrackingView branches", () => {
  it("renders the executive list + map in map view", () => {
    hook.view = "map";
    render(<TrackingView {...props} />);
    expect(screen.getByTestId("exec-list")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.queryByTestId("device-health")).not.toBeInTheDocument();
  });

  it("renders device health in health view", () => {
    hook.view = "health";
    render(<TrackingView {...props} />);
    expect(screen.getByTestId("device-health")).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    hook.view = "map";
  });

  it("shows a fetch error banner", () => {
    hook.displayError = "Request failed (500)";
    render(<TrackingView {...props} />);
    expect(screen.getByText("Request failed (500)")).toBeInTheDocument();
    hook.displayError = null;
  });
});
