import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExecutiveTargets, TargetValues } from "./targets-api";
import type { TargetsPanelState } from "./use-targets-panel";

vi.mock("@/components/ui/popover", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popover: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/lazy-calendar", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LazyCalendar: ({ onSelect }: any) => <button onClick={() => onSelect(new Date(2026, 6, 20))}>cal</button>,
}));
vi.mock("./period-toggle", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PeriodToggle: ({ onChange }: any) => <button onClick={() => onChange("month")}>toggle</button>,
}));

import { TargetsPanelHeader } from "./targets-panel-header";

const clip: TargetValues = { oil: {}};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (over: any): TargetsPanelState => ({
  period: "week", selectedStart: new Date(2026, 6, 6), label: "Week of 06 Jul 2026",
  isFuture: false, isPast: false, isCurrent: true, canEdit: true,
  clipboard: null, executives: [{ userId: "u1" }] as ExecutiveTargets[],
  step: vi.fn(), jumpTo: vi.fn(), goToCurrent: vi.fn(), changePeriod: vi.fn(),
  setBulkError: vi.fn(), setConfirmAll: vi.fn(),
  ...over,
}) as TargetsPanelState;

describe("TargetsPanelHeader", () => {
  it("steps periods, jumps via the calendar, and toggles", () => {
    const p = state({});
    render(<TargetsPanelHeader p={p} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    expect(p.step).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(p.step).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText("cal"));
    expect(p.jumpTo).toHaveBeenCalled();
    fireEvent.click(screen.getByText("toggle"));
    expect(p.changePeriod).toHaveBeenCalledWith("month");
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows the Upcoming badge + a This week link for a future week", () => {
    const p = state({ isFuture: true, isCurrent: false });
    render(<TargetsPanelHeader p={p} />);
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "This week" }));
    expect(p.goToCurrent).toHaveBeenCalled();
  });

  it("shows the Past badge; hides Paste-to-all without a clipboard", () => {
    render(<TargetsPanelHeader p={state({ isPast: true, isCurrent: false, canEdit: false })} />);
    expect(screen.getByText("Past")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Paste to all/ })).not.toBeInTheDocument();
  });

  it("Paste-to-all opens the confirm when a clipboard is set", () => {
    const p = state({ clipboard: clip });
    render(<TargetsPanelHeader p={p} />);
    fireEvent.click(screen.getByRole("button", { name: /Paste to all/ }));
    expect(p.setConfirmAll).toHaveBeenCalledWith(true);
    expect(p.setBulkError).toHaveBeenCalledWith(null);
  });
});
