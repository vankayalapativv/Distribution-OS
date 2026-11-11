import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { TrackedExecutive, TrackingCheckin } from "./tracking-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = vi.hoisted(() => ({ props: null as any }));
vi.mock("vardhan-maps/react", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  IndiaMap: (p: any) => { h.props = p; return <div data-testid="india-map" />; },
}));
vi.mock("framer-motion", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: new Proxy({}, { get: () => ({ children }: any) => <div>{children}</div> }),
}));
vi.mock("./tracking-map-markers", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customerMarkers: (custs: any[]) => custs.map(() => ({ lat: 1, lng: 1 })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkinMarkers: (chks: any[]) => chks.map(() => ({ lat: 2, lng: 2, icon: "flag" })),
}));
vi.mock("./tracking-map-loading", () => ({ MapLoadingOverlay: () => <div data-testid="loading" /> }));

import { TrackingMap } from "./tracking-map";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive =>
  ({ userId: "u1", name: "Ravi", lastLatitude: 17.2, lastLongitude: 80.1, trackingStatus: "fresh", ...over } as TrackedExecutive);
const base = {
  executives: [ex()], routePoints: [],
  // c1 is un-visited (the checkin is for a different, unlisted customer) so it keeps its dot.
  customers: [{ id: "c1" }] as unknown as MapCustomer[],
  checkins: [{ customerId: "zzz" }] as unknown as TrackingCheckin[],
  onSelectExecutive: vi.fn(), selectedUserId: "u1", customerDistricts: ["Nalgonda"],
};

beforeEach(() => { h.props = null; });
afterEach(() => vi.useRealTimers());

describe("TrackingMap", () => {
  it("stacks customer, executive and flag markers", () => {
    render(<TrackingMap {...base} />);
    expect(screen.getByTestId("india-map")).toBeInTheDocument();
    expect(h.props.markers).toHaveLength(3); // 1 customer + 1 exec + 1 flag
  });

  it("hides visit flags while the route is stale", () => {
    render(<TrackingMap {...base} routeStale />);
    expect(h.props.markers).toHaveLength(2); // flag dropped
  });

  it("selects an executive when its position marker is clicked, ignoring flags", () => {
    const onSelectExecutive = vi.fn();
    render(<TrackingMap {...base} onSelectExecutive={onSelectExecutive} />);
    act(() => h.props.onMarkerClick({ lat: 17.2, lng: 80.1 }));
    expect(onSelectExecutive).toHaveBeenCalledWith("u1");
    act(() => h.props.onMarkerClick({ lat: 2, lng: 2, icon: "flag" }));
    expect(onSelectExecutive).toHaveBeenCalledTimes(1);
  });

  it("reveals the map (hides the loader) on render-complete", () => {
    render(<TrackingMap {...base} />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    act(() => h.props.onRenderComplete());
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("reveals the map via the fallback timer if render-complete never fires", () => {
    vi.useFakeTimers();
    render(<TrackingMap {...base} />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("styles only customer districts with a border", () => {
    render(<TrackingMap {...base} customerDistricts={["Nalgonda"]} />);
    expect(h.props.districtFill("Nalgonda").fill).toBe(false); // customer district → visible border
    expect(h.props.districtFill("Elsewhere").stroke).toBe(false); // no customers → hidden
  });

  it("tolerates no selection and no customer districts", () => {
    render(<TrackingMap {...base} selectedUserId={undefined} customerDistricts={undefined} />);
    expect(h.props.dataKey).toBe(""); // empty district set
    expect(h.props.fitKey).toBe("s:none"); // no selection
  });
});
