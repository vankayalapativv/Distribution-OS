import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// AuditSelect now wraps the shared searchable SearchSelect; mock it to a trigger
// label + one button per item so the "all"→"" mapping can be driven.
vi.mock("@/components/ui/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, valueKey, getKey, getLabel, onSelect }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = items.find((i: any) => getKey(i) === valueKey);
    return (
      <div>
        <span>{current ? getLabel(current) : ""}</span>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {items.map((it: any) => (
          <button key={getKey(it)} onClick={() => onSelect(getKey(it))}>{getLabel(it)}</button>
        ))}
      </div>
    );
  },
}));

import { AuditSelect } from "./audit-select";

describe("AuditSelect", () => {
  it("lists the all-option plus every value and shows the all label when empty", () => {
    render(<AuditSelect value="" onChange={vi.fn()} options={["a", "b"]} allLabel="All records" width="w-1" />);
    expect(screen.getAllByText("All records").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
  });

  it("shows the selected value in the trigger", () => {
    render(<AuditSelect value="invoice" onChange={vi.fn()} options={["invoice"]} allLabel="All records" width="w-1" />);
    // Trigger + the option both read "invoice".
    expect(screen.getAllByText("invoice").length).toBe(2);
  });

  it("maps the all-item back to an empty string, real items pass through", () => {
    const onChange = vi.fn();
    render(<AuditSelect value="" onChange={onChange} options={["customer"]} allLabel="All records" width="w-1" />);
    fireEvent.click(screen.getByRole("button", { name: "All records" }));
    expect(onChange).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "customer" }));
    expect(onChange).toHaveBeenCalledWith("customer");
  });
});
