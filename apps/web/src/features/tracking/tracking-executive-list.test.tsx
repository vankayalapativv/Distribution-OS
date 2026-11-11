import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackingExecutiveList } from "./tracking-executive-list";
import type { TrackedExecutive } from "./tracking-api";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive =>
  ({ userId: "u1", name: "Ravi", pointCount: 8, startedAt: "2026-09-14T03:30:00.000Z", endedAt: null,
     lastRecordedAt: "2026-09-14T11:59:00.000Z", trackingStatus: "fresh", ...over } as TrackedExecutive);
const execs = [ex(), ex({ userId: "u2", name: "Anil", trackingStatus: "day_ended" })];

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

const base = { executives: execs, effectiveSelectedUserId: "u1", onSelect: vi.fn(), lastUpdated: null, routePointCount: 3 };

describe("TrackingExecutiveList", () => {
  it("shows the fresh/tracked count and the selected detail", () => {
    render(<TrackingExecutiveList {...base} />);
    expect(screen.getByText("1 fresh · 2 tracked")).toBeInTheDocument();
    expect(screen.getAllByText("Ravi").length).toBeGreaterThan(0); // row + detail
  });

  it("renders the empty state when there is no GPS data", () => {
    render(<TrackingExecutiveList {...base} executives={[]} effectiveSelectedUserId={null} />);
    expect(screen.getByText("No GPS data for this day")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to show/)).toBeInTheDocument();
  });

  it("filters by the search box and shows a no-match message", () => {
    render(<TrackingExecutiveList {...base} />);
    fireEvent.change(screen.getByPlaceholderText("Search executive…"), { target: { value: "zzz" } });
    expect(screen.getByText(/No executive matches/)).toBeInTheDocument();
  });

  it("appends a last-updated time when provided", () => {
    render(<TrackingExecutiveList {...base} lastUpdated={new Date("2026-09-14T06:30:00.000Z")} />);
    expect(screen.getByText(/updated/)).toBeInTheDocument();
  });
});
