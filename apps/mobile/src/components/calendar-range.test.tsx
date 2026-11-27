import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthCalendar } from "./calendar-range";

describe("MonthCalendar", () => {
  it("anchors on `to`, else `from`, else maxDate", () => {
    const { unmount } = render(
      <MonthCalendar from="2026-03-10" to="2026-05-20" maxDate="2026-12-31" onSelectDay={() => {}} />,
    );
    expect(screen.getByText(/May 2026/)).toBeInTheDocument(); // anchored on `to`
    unmount();
    const r2 = render(<MonthCalendar from="2026-03-10" to={null} maxDate="2026-12-31" onSelectDay={() => {}} />);
    expect(screen.getByText(/March 2026/)).toBeInTheDocument(); // anchored on `from`
    r2.unmount();
    render(<MonthCalendar from={null} to={null} maxDate="2026-08-15" onSelectDay={() => {}} />);
    expect(screen.getByText(/August 2026/)).toBeInTheDocument(); // anchored on maxDate
  });

  it("navigates months (and rolls over the year)", () => {
    render(<MonthCalendar from={null} to={null} maxDate="2027-12-31" onSelectDay={() => {}} />);
    // Anchored on Dec 2027 (maxDate). Step forward rolls into Jan 2028.
    // First go back a few months to leave the max month so forward is enabled.
    fireEvent.click(screen.getByLabelText("chevron-back"));
    expect(screen.getByText(/November 2027/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("chevron-forward"));
    expect(screen.getByText(/December 2027/)).toBeInTheDocument();
  });

  it("disables forward navigation at the max month", () => {
    render(<MonthCalendar from={null} to={null} maxDate="2026-06-30" onSelectDay={() => {}} />);
    // Already on June 2026 (the max month) → forward is a no-op.
    fireEvent.click(screen.getByLabelText("chevron-forward"));
    expect(screen.getByText(/June 2026/)).toBeInTheDocument();
  });

  it("selects a day", () => {
    const onSelectDay = vi.fn();
    render(<MonthCalendar from={null} to={null} maxDate="2026-06-30" onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByText("12"));
    expect(onSelectDay).toHaveBeenCalledWith("2026-06-12");
  });
});
