import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuditFiltersState } from "./use-audit-filters";

vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, getKey, getLabel, onSelect }: any) => {
    const it = items[1] ?? items[0];
    return <button onClick={() => onSelect(getKey(it))}>people:{getLabel(it)}</button>;
  },
}));
vi.mock("./audit-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AuditSelect: ({ allLabel, onChange }: any) => <button onClick={() => onChange("picked")}>{allLabel}</button>,
}));
vi.mock("@/components/ui/lazy-calendar", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LazyCalendar: ({ onSelect }: any) => <button onClick={() => onSelect({ from: new Date(2026, 6, 1) })}>cal</button>,
}));
vi.mock("@/components/ui/popover", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popover: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

import { AuditLogsFilters } from "./audit-logs-filters";

const state = (over: Partial<AuditFiltersState> = {}): AuditFiltersState => ({
  search: "", setSearch: vi.fn(), actorId: "", setActorId: vi.fn(),
  entityType: "", setEntityType: vi.fn(), action: "", setAction: vi.fn(),
  dateRange: undefined, setDateRange: vi.fn(), fromDate: "", toDate: "",
  hasFilters: false, dateLabel: "Any date", reset: vi.fn(),
  serverFilters: { q: "", actorId: "", entityType: "", action: "", fromDate: "", toDate: "" },
  ...over,
}) as AuditFiltersState;

const opts = { actors: [{ id: "u1", name: "Asha" }], entityTypes: ["customer"], actions: ["update"] };

describe("AuditLogsFilters", () => {
  it("wires search, person, both selects and the calendar", () => {
    const f = state();
    render(<AuditLogsFilters f={f} opts={opts} isLoading={false} total={3} />);
    fireEvent.change(screen.getByPlaceholderText(/Search summary/), { target: { value: "z" } });
    expect(f.setSearch).toHaveBeenCalledWith("z");
    // items[1] is the first real actor (index 0 is the injected "All people").
    fireEvent.click(screen.getByText("people:Asha"));
    expect(f.setActorId).toHaveBeenCalledWith("u1");
    fireEvent.click(screen.getByText("All records"));
    expect(f.setEntityType).toHaveBeenCalledWith("picked");
    fireEvent.click(screen.getByText("All actions"));
    expect(f.setAction).toHaveBeenCalledWith("picked");
    fireEvent.click(screen.getByText("cal"));
    expect(f.setDateRange).toHaveBeenCalled();
    expect(screen.getByText("3 results")).toBeInTheDocument();
  });

  it("shows Clear only when filters are active", () => {
    const f = state({ hasFilters: true });
    render(<AuditLogsFilters f={f} opts={opts} isLoading={false} total={1} />);
    expect(screen.getByText("1 result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(f.reset).toHaveBeenCalled();
  });

  it("hides Clear and shows Loading… with no options", () => {
    render(<AuditLogsFilters f={state()} opts={undefined} isLoading={true} total={0} />);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("highlights the date label when a range is set", () => {
    const f = state({ dateRange: { from: new Date(2026, 6, 1), to: undefined }, dateLabel: "01 Jul 2026" });
    render(<AuditLogsFilters f={f} opts={opts} isLoading={false} total={1} />);
    expect(screen.getByText("01 Jul 2026").className).toContain("text-foreground");
  });
});
