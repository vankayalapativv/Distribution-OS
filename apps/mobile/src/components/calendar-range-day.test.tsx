import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DayCell } from "./calendar-range-day";

const base = {
  y: 2026,
  m: 10, // November (0-indexed)
  from: null as string | null,
  to: null as string | null,
  maxDate: "2026-11-30",
  onSelectDay: () => {},
};

describe("DayCell", () => {
  it("renders a blank filler when day is null", () => {
    const { container } = render(<DayCell {...base} day={null} />);
    expect(container.textContent).toBe("");
  });

  it("renders a selectable day and fires onSelectDay with its ymd", () => {
    const onSelectDay = vi.fn();
    render(<DayCell {...base} day={15} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByText("15"));
    expect(onSelectDay).toHaveBeenCalledWith("2026-11-15");
  });

  it("disables days after maxDate (no selection)", () => {
    const onSelectDay = vi.fn();
    render(<DayCell {...base} day={30} maxDate="2026-11-20" onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByText("30"));
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("highlights the start, end, and in-range days of a span", () => {
    // from=10, to=20 → day 10 is start, 20 is end, 15 is in-range.
    const span = { ...base, from: "2026-11-10", to: "2026-11-20" };
    expect(render(<DayCell {...span} day={10} />).container.textContent).toBe("10");
    expect(render(<DayCell {...span} day={20} />).container.textContent).toBe("20");
    expect(render(<DayCell {...span} day={15} />).container.textContent).toBe("15");
  });

  it("treats a single-day selection (from === to) as an endpoint without a track", () => {
    render(<DayCell {...base} from="2026-11-12" to="2026-11-12" day={12} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
