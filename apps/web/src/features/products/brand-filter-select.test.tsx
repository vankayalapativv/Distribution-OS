import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock the shared combobox so the wrapper's item-building + handlers run inline.
let last: any = null;
vi.mock("@/features/orders/order-search-combobox", () => ({
  OrderSearchCombobox: (p: any) => {
    last = p;
    return (
      <div>
        <button data-testid="trigger" onClick={() => p.onOpenChange(!p.open)}>{p.triggerLabel}</button>
        <input aria-label="search" value={p.searchValue} ref={(el) => p.registerSearchInput?.(el)}
          onChange={(e) => p.onSearchChange(e.target.value)} />
        {p.items.length === 0 && <span>{p.emptyText}</span>}
        {p.items.map((it: any) => (
          <button key={p.getKey(it)} data-sel={p.isSelected(it)} onClick={() => p.onSelect(it)}>{p.renderItem(it)}</button>
        ))}
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { BrandFilterSelect } from "./brand-filter-select";

const opts = ["Fuchs", "Savsol"];

describe("BrandFilterSelect", () => {
  it("lists All brands + options, selects, and filters by search", () => {
    const onChange = vi.fn();
    render(<BrandFilterSelect brand="__all__" onChange={onChange} options={opts} />);
    expect(last.items.map((i: { label: string }) => i.label)).toEqual(["All brands", "Fuchs", "Savsol"]);
    expect(last.items[0]).toMatchObject({ value: "__all__", label: "All brands" });

    fireEvent.click(screen.getByText("Savsol")); // unambiguous (item only)
    expect(onChange).toHaveBeenCalledWith("Savsol");

    fireEvent.change(screen.getByLabelText("search"), { target: { value: "fuc" } });
    expect(last.items.map((i: { label: string }) => i.label)).toEqual(["Fuchs"]);
  });

  it("shows the chosen brand as the label and toggles open/closed (clearing search)", () => {
    render(<BrandFilterSelect brand="Fuchs" onChange={vi.fn()} options={opts} />);
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("trigger")); // open
    fireEvent.click(screen.getByTestId("trigger")); // close → clears search
    expect(last.searchValue).toBe("");
    expect(last.isSelected({ value: "Fuchs", label: "Fuchs" })).toBe(true);
  });
});
