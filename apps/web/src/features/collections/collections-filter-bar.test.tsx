import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Both the status filter and the collector picker are now the shared SearchSelect;
// branch on placeholder so each renders a distinct button.
vi.mock("@/components/ui/search-select", () => ({
  SearchSelect: ({ placeholder, onSelect }: { readonly placeholder: string; readonly onSelect: (v: string) => void }) =>
    placeholder === "All executives"
      ? <button onClick={() => onSelect("u9")}>collector</button>
      : <button onClick={() => onSelect("pending")}>status</button>,
}));
vi.mock("@/components/ui/lazy-calendar", () => ({
  LazyCalendar: ({ onSelect }: { readonly onSelect: (d: Date) => void }) => <button onClick={() => onSelect(new Date(2026, 8, 20))}>cal</button>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

import { CollectionsFilterBar } from "./collections-filter-bar";

const base = {
  statusFilter: "all", onStatus: vi.fn(), search: "", setSearch: vi.fn(),
  collectors: [], collectedBy: "", onCollectedBy: vi.fn(),
  collectionDate: undefined, dateOpen: false, setDateOpen: vi.fn(), onDate: vi.fn(),
  customerId: "", customerName: null, onClearCustomer: vi.fn(),
  hasFilters: false, onClear: vi.fn(), total: 7, isLoading: false,
};

describe("CollectionsFilterBar", () => {
  it("types into search, changes status, collector and date", () => {
    const p = { ...base, onStatus: vi.fn(), setSearch: vi.fn(), onCollectedBy: vi.fn(), onDate: vi.fn() };
    render(<CollectionsFilterBar {...p} />);
    fireEvent.change(screen.getByPlaceholderText("Search code or customer…"), { target: { value: "COL" } });
    fireEvent.click(screen.getByText("status"));
    fireEvent.click(screen.getByText("collector"));
    fireEvent.click(screen.getByText("cal"));
    expect(p.setSearch).toHaveBeenCalledWith("COL");
    expect(p.onStatus).toHaveBeenCalledWith("pending");
    expect(p.onCollectedBy).toHaveBeenCalledWith("u9");
    expect(p.onDate).toHaveBeenCalled();
  });

  it("shows the result count", () => {
    render(<CollectionsFilterBar {...base} />);
    expect(screen.getByText("7 results")).toBeInTheDocument();
  });

  it("shows a Clear button only when filters are active", () => {
    const onClear = vi.fn();
    const { rerender } = render(<CollectionsFilterBar {...base} hasFilters={false} />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    rerender(<CollectionsFilterBar {...base} hasFilters onClear={onClear} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows a customer chip that clears the customer filter", () => {
    const onClearCustomer = vi.fn();
    render(<CollectionsFilterBar {...base} customerId="cu1" customerName="Sri Laxmi" onClearCustomer={onClearCustomer} />);
    fireEvent.click(screen.getByText("Sri Laxmi"));
    expect(onClearCustomer).toHaveBeenCalled();
  });
});
