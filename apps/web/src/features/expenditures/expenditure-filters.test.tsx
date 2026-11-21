import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenditureCategory } from "./expenditures-api";
import type { ExpendituresListState } from "./use-expenditures-list";

// Both the type filter and the category picker are now the shared SearchSelect;
// branch on placeholder so each renders a distinct button.
vi.mock("@/components/ui/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ placeholder, items, getKey, getLabel, onSelect }: any) =>
    placeholder === "All categories" ? (
      <>
        {/* items[1] is the first real category (index 0 is the injected "All categories"). */}
        <button onClick={() => onSelect(getKey(items[1]))}>cat:{getLabel(items[1])}</button>
        <button onClick={() => onSelect("")}>cat-clear</button>
      </>
    ) : (
      <>
        {/* items[1] of the type filter is "Compulsory"; exercise its getKey + getLabel. */}
        <button onClick={() => onSelect(getKey(items[1]))}>type:{getLabel(items[1])}</button>
        <button onClick={() => onSelect("")}>type-clear</button>
      </>
    ),
}));

import { ExpenditureFilters } from "./expenditure-filters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (over: any): ExpendituresListState => ({
  from: "2026-07-01", to: "2026-07-31", setPeriod: vi.fn(),
  typeFilter: "all", setTypeFilter: vi.fn(), categoryFilter: "all", setCategoryFilter: vi.fn(),
  search: "", setSearch: vi.fn(), hasFilters: false, clearFilters: vi.fn(), ...over,
}) as ExpendituresListState;
const categories: ExpenditureCategory[] = [{ id: "c1", name: "Rent", type: "compulsory", isSystem: true, isActive: true }];

describe("ExpenditureFilters", () => {
  it("wires the search box, the type select and the category select", () => {
    const s = state({});
    render(<ExpenditureFilters s={s} categories={categories} />);
    fireEvent.change(screen.getByPlaceholderText(/Search code/), { target: { value: "fuel" } });
    expect(s.setSearch).toHaveBeenCalledWith("fuel");
    fireEvent.click(screen.getByText("type:Compulsory"));
    expect(s.setTypeFilter).toHaveBeenCalledWith("compulsory");
    fireEvent.click(screen.getByText("cat:Rent")); // getKey/getLabel resolve the category
    expect(s.setCategoryFilter).toHaveBeenCalledWith("c1");
  });

  it("clearing a select maps the empty value back to 'all' (both selects)", () => {
    const s = state({ typeFilter: "", categoryFilter: "" }); // exercise the `?? "all"` valueKey fallbacks
    render(<ExpenditureFilters s={s} categories={categories} />);
    fireEvent.click(screen.getByText("type-clear"));
    expect(s.setTypeFilter).toHaveBeenCalledWith("all");
    fireEvent.click(screen.getByText("cat-clear"));
    expect(s.setCategoryFilter).toHaveBeenCalledWith("all");
  });

  it("shows a Clear button only when a filter is active", () => {
    const inactive = state({ hasFilters: false });
    const { rerender } = render(<ExpenditureFilters s={inactive} categories={categories} />);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    const active = state({ hasFilters: true });
    rerender(<ExpenditureFilters s={active} categories={categories} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(active.clearFilters).toHaveBeenCalled();
  });
});
