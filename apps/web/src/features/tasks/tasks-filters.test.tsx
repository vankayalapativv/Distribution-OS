import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The priority filter is the shared searchable SearchSelect (a Popover combobox);
// mock it to a plain <select> so this test can drive the change event.
vi.mock("@/components/ui/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, valueKey, getKey, getLabel, onSelect }: any) => (
    <select value={valueKey} onChange={(e) => onSelect(e.target.value)}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((it: any) => (
        <option key={getKey(it)} value={getKey(it)}>{getLabel(it)}</option>
      ))}
    </select>
  ),
}));

import { TasksFilters } from "./tasks-filters";

const base = {
  statusTab: "open" as const, onStatusTab: vi.fn(), mineOnly: false, onToggleMine: vi.fn(),
  priorityFilter: "", onPriorityFilter: vi.fn(),
};

describe("TasksFilters", () => {
  it("highlights the active status tab and switches tabs", () => {
    const onStatusTab = vi.fn();
    render(<TasksFilters {...base} onStatusTab={onStatusTab} />);
    expect(screen.getByText("Open").className).toMatch(/bg-primary/);
    fireEvent.click(screen.getByText("Done"));
    expect(onStatusTab).toHaveBeenCalledWith("done");
  });

  it("toggles My tasks and shows it active when set", () => {
    const onToggleMine = vi.fn();
    const { rerender } = render(<TasksFilters {...base} onToggleMine={onToggleMine} />);
    fireEvent.click(screen.getByText("My tasks"));
    expect(onToggleMine).toHaveBeenCalled();
    rerender(<TasksFilters {...base} mineOnly />);
    expect(screen.getByText("My tasks").className).toMatch(/bg-primary/);
  });

  it("changes the priority filter", () => {
    const onPriorityFilter = vi.fn();
    render(<TasksFilters {...base} onPriorityFilter={onPriorityFilter} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "high" } });
    expect(onPriorityFilter).toHaveBeenCalledWith("high");
  });
});
