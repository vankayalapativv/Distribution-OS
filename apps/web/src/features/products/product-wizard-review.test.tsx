import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardReview } from "./product-wizard-review";
import type { ProductForm } from "./use-product-form";

const mk = (over: Partial<ProductForm> = {}) =>
  ({ productName: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", segments: ["Car", "2W"], ...over } as unknown as ProductForm);

describe("WizardReview", () => {
  it("summarises product + segments and jumps back on Edit", () => {
    const onEditStep = vi.fn();
    render(<WizardReview f={mk()} onEditStep={onEditStep} />);
    expect(screen.getByText("Fuchs 10W40 · Fuchs · HSN 27101980")).toBeInTheDocument();
    expect(screen.getByText("Car, 2W")).toBeInTheDocument();
    const edits = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(edits[0]);
    fireEvent.click(edits[1]);
    expect(onEditStep).toHaveBeenNthCalledWith(1, 0);
    expect(onEditStep).toHaveBeenNthCalledWith(2, 1);
  });

  it("falls back to — for empty name / brand / hsn / segments", () => {
    render(<WizardReview f={mk({ productName: "", brand: "", hsnCode: "", segments: [] })} onEditStep={vi.fn()} />);
    expect(screen.getAllByText("—").length).toBe(2); // product line + segments line
  });
});
