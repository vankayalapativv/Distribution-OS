import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Collect every mounted calendar's onSelect so multi-picker components (the range
// filter mounts two) can be driven individually: selects[0] = first field, etc.
const cal = vi.hoisted((): { onSelect: (v: unknown) => void; selects: ((v: unknown) => void)[] } => ({
  onSelect: () => {},
  selects: [],
}));
vi.mock("@/components/ui/lazy-calendar", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LazyCalendar: ({ onSelect }: any) => {
    cal.onSelect = onSelect;
    cal.selects.push(onSelect);
    return <div>cal</div>;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popover: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverTrigger: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

import { DatePicker, DateRangePicker } from "./expenditure-date-picker";

describe("DatePicker", () => {
  it("shows the placeholder when empty and the formatted date when set", () => {
    const { rerender } = render(<DatePicker value="" onChange={vi.fn()} placeholder="Pick a date" />);
    expect(screen.getByText("Pick a date")).toBeInTheDocument();
    rerender(<DatePicker value="2026-07-18" onChange={vi.fn()} />);
    expect(screen.getByText("18 Jul 2026")).toBeInTheDocument();
  });

  it("emits the picked day as YYYY-MM-DD, and blanks a cleared day", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);
    cal.onSelect(new Date(2026, 6, 18));
    expect(onChange).toHaveBeenCalledWith("2026-07-18");
    cal.onSelect(undefined); // cleared → "", popover stays open
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("DateRangePicker (two From/To fields)", () => {
  it("labels each field with its applied date", () => {
    render(<DateRangePicker from="2026-07-01" to="2026-07-31" onChange={vi.fn()} />);
    expect(screen.getByText("01 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("31 Jul 2026")).toBeInTheDocument();
  });

  it("prompts From / To when empty", () => {
    render(<DateRangePicker from="" to="" onChange={vi.fn()} />);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("changing the From field keeps the existing To (both ends emitted together)", () => {
    cal.selects = [];
    const onChange = vi.fn();
    render(<DateRangePicker from="2026-07-01" to="2026-07-31" onChange={onChange} />);
    cal.selects[0](new Date(2026, 6, 5)); // first field = From
    expect(onChange).toHaveBeenCalledWith("2026-07-05", "2026-07-31");
  });

  it("changing the To field keeps the existing From", () => {
    cal.selects = [];
    const onChange = vi.fn();
    render(<DateRangePicker from="2026-07-01" to="2026-07-31" onChange={onChange} />);
    cal.selects[1](new Date(2026, 7, 10)); // second field = To
    expect(onChange).toHaveBeenCalledWith("2026-07-01", "2026-08-10");
  });
});
