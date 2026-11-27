import { describe, expect, it, vi } from "vitest";
vi.mock("../../lib/admin-tracking", () => ({ istToday: () => "2026-11-27" }));

import { fireEvent, render, screen } from "@testing-library/react";
import { TrackingDateStepper } from "./tracking-date-stepper";

describe("TrackingDateStepper", () => {
  it("shows 'Today' and steps a day back", () => {
    const setDate = vi.fn();
    render(<TrackingDateStepper date="2026-11-27" setDate={setDate} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    const stepFn = setDate.mock.calls[0][0] as (d: string) => string;
    expect(stepFn("2026-11-27")).toBe("2026-11-26"); // one day back
  });

  it("can step forward only when before today", () => {
    const setDate = vi.fn();
    render(<TrackingDateStepper date="2026-11-25" setDate={setDate} />);
    expect(screen.getByText("2026-11-25")).toBeInTheDocument(); // not 'Today'
    fireEvent.click(screen.getByText("›"));
    const stepFn = setDate.mock.calls[0][0] as (d: string) => string;
    expect(stepFn("2026-11-25")).toBe("2026-11-26"); // forward
    expect(stepFn("2026-11-27")).toBe("2026-11-27"); // capped at today
  });
});
