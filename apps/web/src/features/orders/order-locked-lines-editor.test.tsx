import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderLockedLinesEditor } from "./order-locked-lines-editor";
import type { LockedLine } from "./order-draft-types";

const lines: LockedLine[] = [
  { orderItemId: "oi1", label: "TITAN 5W-30", brand: "Fuchs", segment: "Car", packSizeLitres: 1, invoicedUnits: 2, deliveredUnits: 0, orderedUnits: 5, quantityUnits: "5" },
  { orderItemId: "oi2", label: "GEAR 90", brand: "Savsol", segment: "Gear Oil", packSizeLitres: 1, invoicedUnits: 1, deliveredUnits: 0, orderedUnits: 3, quantityUnits: "3" },
];

describe("OrderLockedLinesEditor", () => {
  it("lists each locked line with its label in the fulfilled section", () => {
    render(<OrderLockedLinesEditor lockedLines={lines} onSetQty={() => {}} />);
    expect(screen.getByText("Already fulfilled — locked")).toBeInTheDocument();
    // Labels appear in the fulfilled section (and again in the remainder editor).
    expect(screen.getAllByText("TITAN 5W-30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GEAR 90").length).toBeGreaterThan(0);
  });

  it("shows the un-invoiced remainder as a prefilled quantity field (ordered − billed)", () => {
    render(<OrderLockedLinesEditor lockedLines={[lines[0]]} onSetQty={() => {}} />);
    // 5 ordered − 2 billed → remainder of 3, editable down to 0.
    const input = screen.getByDisplayValue("3");
    expect(input).toHaveAttribute("min", "0");
  });

  it("reports edits as the new TOTAL (billed + remainder) by order-item id", () => {
    const onSetQty = vi.fn();
    render(<OrderLockedLinesEditor lockedLines={[lines[0]]} onSetQty={onSetQty} />);
    // Set the remainder to 7 → total becomes 2 billed + 7 = 9.
    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "7" } });
    expect(onSetQty).toHaveBeenCalledWith("oi1", "9");
  });

  it("keeps a delivered line's shipped units locked but lets its remainder be edited", () => {
    const delivered: LockedLine = { orderItemId: "oi3", label: "DELIVERED OIL", brand: "Fuchs", segment: "Car", packSizeLitres: 1, invoicedUnits: 4, deliveredUnits: 4, orderedUnits: 5, quantityUnits: "5" };
    render(<OrderLockedLinesEditor lockedLines={[delivered]} onSetQty={() => {}} />);
    // Shipped portion is shown read-only.
    expect(screen.getAllByText("DELIVERED OIL").length).toBeGreaterThan(0);
    expect(screen.getByText("4 delivered")).toBeInTheDocument();
    // 5 ordered − 4 billed → an editable remainder of 1.
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });

  it("keeps the remainder row mounted when the field is cleared (no vanishing)", () => {
    render(<OrderLockedLinesEditor lockedLines={[lines[0]]} onSetQty={() => {}} />);
    const input = screen.getByDisplayValue("3");
    // Clearing the field to empty must NOT remove the row — the box stays editable.
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
    expect(screen.getByText("Remaining to invoice — quantity only")).toBeInTheDocument();
  });

  it("offers no remainder field when a line is fully billed", () => {
    const fully: LockedLine = { orderItemId: "oi4", label: "FULL OIL", brand: "Fuchs", segment: "Car", packSizeLitres: 1, invoicedUnits: 5, deliveredUnits: 5, orderedUnits: 5, quantityUnits: "5" };
    render(<OrderLockedLinesEditor lockedLines={[fully]} onSetQty={() => {}} />);
    expect(screen.getByText("5 delivered")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
