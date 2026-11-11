import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the lazily-loaded calendar with a button that picks a fixed date, so the
// onSelect → onChange + close path is synchronous and testable.
const PICKED = new Date(2026, 0, 15);
vi.mock("@/components/ui/lazy-calendar", () => ({
  LazyCalendar: ({ onSelect }: { readonly onSelect: (d: Date | undefined) => void }) => (
    <button onClick={() => onSelect(PICKED)}>pick-date</button>
  ),
}));

import { OrderDateField } from "./order-date-field";

describe("OrderDateField", () => {
  it("shows 'Today' when no date is selected", () => {
    render(<OrderDateField value={undefined} onChange={() => {}} open={false} onOpenChange={() => {}} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("formats a selected date", () => {
    render(<OrderDateField value={PICKED} onChange={() => {}} open={false} onOpenChange={() => {}} />);
    expect(screen.getByText("15 Jan 2026")).toBeInTheDocument();
  });

  it("exposes the date as a clickable trigger button", () => {
    render(<OrderDateField value={undefined} onChange={() => {}} open={false} onOpenChange={() => {}} />);
    const trigger = screen.getByText("Today").closest("button");
    expect(trigger).toBeInTheDocument();
  });

  it("picking a date reports it and closes the popover", () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<OrderDateField value={undefined} onChange={onChange} open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText("pick-date"));
    expect(onChange).toHaveBeenCalledWith(PICKED);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
