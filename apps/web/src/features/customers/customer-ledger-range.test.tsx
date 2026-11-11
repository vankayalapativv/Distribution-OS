import { fireEvent, render, screen } from "@testing-library/react";
import type { DateRange } from "react-day-picker";
import { describe, expect, it, vi } from "vitest";

// Capture handlers the component passes down so we can drive the calendar/popover.
let onSelect: (sel: DateRange | undefined) => void;
let onOpenChange: (o: boolean, d?: { reason?: string }) => void;

vi.mock("@/components/ui/lazy-calendar", () => ({
  LazyCalendar: (p: { onSelect: (sel: DateRange | undefined) => void }) => {
    onSelect = p.onSelect;
    return <div data-testid="calendar" />;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: (p: { children: React.ReactNode; onOpenChange: typeof onOpenChange }) => {
    onOpenChange = p.onOpenChange;
    return <div>{p.children}</div>;
  },
  PopoverTrigger: (p: { children: React.ReactNode }) => <button>{p.children}</button>,
  PopoverContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));

import { LedgerDateRange } from "./customer-ledger-range";

const base = {
  from: "2026-06-01",
  to: "2026-06-15",
  preset: "custom" as const,
  open: false,
  onOpenChange: vi.fn(),
  onPreset: vi.fn(),
  onCalendar: vi.fn(),
};

describe("LedgerDateRange", () => {
  it("renders preset chips + the range label and fires onPreset on click", () => {
    const onPreset = vi.fn();
    render(<LedgerDateRange {...base} preset="this-month" onPreset={onPreset} />);
    expect(screen.getByText("01 Jun 2026 – 15 Jun 2026")).toBeInTheDocument();
    // the active chip carries the primary styling
    expect(screen.getByRole("button", { name: "This month" }).className).toContain("bg-primary");
    fireEvent.click(screen.getByRole("button", { name: "Last month" }));
    expect(onPreset).toHaveBeenCalledWith("last-month");
  });

  it("wires the calendar + popover through to the parent callbacks", () => {
    const onCalendar = vi.fn();
    const onOpen = vi.fn();
    render(<LedgerDateRange {...base} onCalendar={onCalendar} onOpenChange={onOpen} />);

    // two picks commit the range
    onSelect({ from: new Date(), to: new Date() });
    const range = { from: new Date("2026-06-01"), to: new Date("2026-06-10") };
    onSelect(range);
    expect(onCalendar).toHaveBeenCalledWith(range);

    onOpenChange(true);
    expect(onOpen).toHaveBeenCalledWith(true);
  });

  it("renders with no applied range (blank from) without a default month", () => {
    render(<LedgerDateRange {...base} from="" to="" preset="all" />);
    expect(screen.getAllByText("All time").length).toBeGreaterThan(0);
    expect(screen.getByTestId("calendar")).toBeInTheDocument();
  });
});
