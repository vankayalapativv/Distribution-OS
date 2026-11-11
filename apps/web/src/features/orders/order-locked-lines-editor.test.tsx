import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderLockedLinesEditor } from "./order-locked-lines-editor";
import type { LockedLine } from "./order-draft-types";

const lines: LockedLine[] = [
  { orderItemId: "oi1", label: "TITAN 5W-30", invoicedUnits: 2, quantityUnits: "5" },
  { orderItemId: "oi2", label: "GEAR 90", invoicedUnits: 1, quantityUnits: "3" },
];

describe("OrderLockedLinesEditor", () => {
  it("lists each locked line with its label + billed count", () => {
    render(<OrderLockedLinesEditor lockedLines={lines} onSetQty={() => {}} />);
    expect(screen.getByText("TITAN 5W-30")).toBeInTheDocument();
    expect(screen.getByText("2 billed")).toBeInTheDocument();
    expect(screen.getByText("GEAR 90")).toBeInTheDocument();
  });

  it("enforces a minimum of the billed amount on the quantity input", () => {
    render(<OrderLockedLinesEditor lockedLines={[lines[0]]} onSetQty={() => {}} />);
    expect(screen.getByDisplayValue("5")).toHaveAttribute("min", "2");
  });

  it("reports quantity edits by order-item id", () => {
    const onSetQty = vi.fn();
    render(<OrderLockedLinesEditor lockedLines={lines} onSetQty={onSetQty} />);
    fireEvent.change(screen.getByDisplayValue("5"), { target: { value: "7" } });
    expect(onSetQty).toHaveBeenCalledWith("oi1", "7");
  });
});
