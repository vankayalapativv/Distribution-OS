import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductSegmentsField, ProductUnitToggle } from "./product-class-fields";
import type { ProductForm } from "./use-product-form";

const mk = (over: Partial<ProductForm> = {}) =>
  ({ unit: "litres", setUnit: vi.fn(), segments: ["Car"], toggleSegment: vi.fn(),
     fieldErrors: {}, touched: {}, ...over } as unknown as ProductForm);

describe("ProductUnitToggle", () => {
  it("highlights the active unit and switches on click", () => {
    const f = mk({ unit: "litres" });
    const { rerender } = render(<ProductUnitToggle f={f} />);
    fireEvent.click(screen.getByRole("button", { name: "Quantity (pieces)" }));
    expect(f.setUnit).toHaveBeenCalledWith("quantity");
    fireEvent.click(screen.getByRole("button", { name: "Litres (pack sizes)" }));
    expect(f.setUnit).toHaveBeenCalledWith("litres");
    expect(screen.getByText(/picks a pack size/)).toBeInTheDocument(); // litres hint
    rerender(<ProductUnitToggle f={mk({ unit: "quantity" })} />);
    expect(screen.getByText(/Sold by the piece/)).toBeInTheDocument(); // quantity hint
  });
});

describe("ProductSegmentsField", () => {
  it("renders chips, toggles, and shows the error only when touched", () => {
    const f = mk({ segments: ["Car"], fieldErrors: { segments: "Pick one." }, touched: { segments: true } });
    render(<ProductSegmentsField f={f} idPrefix="err" segmentsRef={createRef()} />);
    fireEvent.click(screen.getByRole("button", { name: "2W" }));
    expect(f.toggleSegment).toHaveBeenCalledWith("2W");
    expect(screen.getByText("Pick one.")).toBeInTheDocument();
  });

  it("hides the error until the field is touched", () => {
    render(<ProductSegmentsField f={mk({ fieldErrors: { segments: "Pick one." } })} idPrefix="err" segmentsRef={createRef()} />);
    expect(screen.queryByText("Pick one.")).not.toBeInTheDocument();
  });
});
