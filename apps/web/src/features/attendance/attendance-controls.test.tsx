import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateNav, MonthNav, StatusLegend } from "./attendance-controls";

describe("MonthNav", () => {
  it("shows the month title and shifts on the nav buttons", () => {
    const onShift = vi.fn();
    render(<MonthNav month="2026-07" onShift={onShift} atCurrentMonth={false} />);
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onShift).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onShift).toHaveBeenCalledWith(1);
  });

  it("disables Next at the current month", () => {
    render(<MonthNav month="2026-07" onShift={vi.fn()} atCurrentMonth={true} />);
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });
});

describe("DateNav", () => {
  it("shows the date and steps it with the prev/next buttons", () => {
    const setDate = vi.fn();
    render(<DateNav date="2026-07-28" setDate={setDate} />);
    expect(screen.getByText(/28 Jul/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(setDate).toHaveBeenCalledWith("2026-07-27");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(setDate).toHaveBeenCalledWith("2026-07-29");
  });
});

describe("StatusLegend", () => {
  it("lists all six statuses", () => {
    render(<StatusLegend />);
    for (const label of ["Present", "Absent", "Half day", "Leave", "Week-off", "Holiday"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
