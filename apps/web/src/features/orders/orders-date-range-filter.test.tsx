import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/components/ui/lazy-calendar", () => ({
  LazyCalendar: (p: any) => (
    <button data-testid="cal" onClick={() => p.onSelect({ from: new Date(2026, 2, 1), to: new Date(2026, 2, 5) })}>
      cal
    </button>
  ),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersDateRangeFilter } from "./orders-date-range-filter";

afterEach(() => vi.restoreAllMocks());

describe("OrdersDateRangeFilter", () => {
  it("shows a placeholder when no range is chosen", () => {
    render(<OrdersDateRangeFilter dateRange={undefined} onDateRangeChange={() => {}} />);
    expect(screen.getByText("Pick a date range")).toBeInTheDocument();
  });

  it("shows a single date when only 'from' is set", () => {
    render(<OrdersDateRangeFilter dateRange={{ from: new Date(2026, 2, 1) }} onDateRangeChange={() => {}} />);
    expect(screen.getByText("01 Mar 2026")).toBeInTheDocument();
  });

  it("shows a from–to range", () => {
    render(
      <OrdersDateRangeFilter
        dateRange={{ from: new Date(2026, 2, 1), to: new Date(2026, 2, 5) }}
        onDateRangeChange={() => {}}
      />,
    );
    expect(screen.getByText("01 Mar – 05 Mar 2026")).toBeInTheDocument();
  });

  it("forwards the calendar selection", () => {
    const onChange = vi.fn();
    render(<OrdersDateRangeFilter dateRange={undefined} onDateRangeChange={onChange} />);
    fireEvent.click(screen.getByText("Pick a date range"));
    fireEvent.click(screen.getByTestId("cal"));
    expect(onChange).toHaveBeenCalledWith({ from: new Date(2026, 2, 1), to: new Date(2026, 2, 5) });
  });
});
