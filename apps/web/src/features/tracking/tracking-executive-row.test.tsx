import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackingExecutiveRow } from "./tracking-executive-row";
import type { TrackedExecutive } from "./tracking-api";

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive =>
  ({ userId: "u1", name: "Ravi", pointCount: 8, lastRecordedAt: "2026-09-14T11:59:00.000Z", trackingStatus: "fresh", ...over } as TrackedExecutive);

beforeEach(() => vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z")));
afterEach(() => vi.useRealTimers());

describe("TrackingExecutiveRow", () => {
  it("shows the name, point count, default location label and status", () => {
    render(<TrackingExecutiveRow ex={ex()} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText(/8 points/)).toBeInTheDocument();
    expect(screen.getByText(/Latest known location/)).toBeInTheDocument();
    expect(screen.getByText("Fresh")).toBeInTheDocument();
  });

  it("selects the executive on click", () => {
    const onSelect = vi.fn();
    render(<TrackingExecutiveRow ex={ex()} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("u1");
  });

  it("highlights the selected row", () => {
    render(<TrackingExecutiveRow ex={ex()} selected onSelect={() => {}} />);
    expect(screen.getByRole("button").className).toMatch(/bg-blue-50/);
  });
});
