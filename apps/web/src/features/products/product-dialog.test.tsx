import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, defaults } from "./product-dialog.test-kit";

/* eslint-disable @typescript-eslint/no-explicit-any */
const form = defaults();
vi.mock("./use-product-form", () => ({
  useProductForm: () => form,
  FIELD_STEP: { name: 0, brand: 0, hsnCode: 0, segments: 1, packs: 2 },
}));
vi.mock("./brand-field", () => ({
  BrandField: ({ onChange }: any) => <button type="button" onClick={() => onChange("Shell")}>brand</button>,
}));
vi.mock("./pack-rows", () => ({
  PackRows: ({ onChange }: any) => <button type="button" onClick={() => onChange([])}>packs</button>,
}));
// rAF → sync so focusField runs during the test.
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }); Object.assign(form, defaults()); });
/* eslint-enable @typescript-eslint/no-explicit-any */

import { ProductDialog } from "./product-dialog";

const props = { open: true, onOpenChange: vi.fn(), actionConfig: config };
const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

describe("ProductDialog — add wizard", () => {
  it("walks the 3 steps: details → segment chips → packs + Create", () => {
    render(<ProductDialog {...props} editTarget={null} />);
    expect(screen.getByText("Add product")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Fuchs 10W-40")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gear Oil" })).not.toBeInTheDocument();
    next();
    expect(screen.getByRole("button", { name: "Car" })).toBeInTheDocument();
    next();
    expect(screen.getByText("packs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeInTheDocument();
  });

  it("Cancel closes the wizard", () => {
    const onOpenChange = vi.fn();
    render(<ProductDialog {...props} onOpenChange={onOpenChange} editTarget={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("edits across steps reach the hook; Back returns; review Edit jumps to a step", () => {
    render(<ProductDialog {...props} editTarget={null} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Fuchs 10W-40"), { target: { value: "Shell 20W50" } });
    expect(form.setProductName).toHaveBeenCalledWith("Shell 20W50");
    fireEvent.change(screen.getByPlaceholderText(/27101980/), { target: { value: "2710a1980" } });
    expect(form.setHsnCode).toHaveBeenCalledWith("27101980"); // strips non-digits
    fireEvent.click(screen.getByText("brand"));
    expect(form.setBrand).toHaveBeenCalledWith("Shell");
    next();
    fireEvent.click(screen.getByRole("button", { name: "2W" }));
    expect(form.toggleSegment).toHaveBeenCalledWith("2W");
    fireEvent.click(screen.getByRole("button", { name: "Back" })); // back to step 0
    expect(screen.getByPlaceholderText("e.g. Fuchs 10W-40")).toBeInTheDocument();
    next(); next();
    fireEvent.click(screen.getByText("packs"));
    expect(form.setPacks).toHaveBeenCalledWith([]);
    // the step-3 review "Edit" buttons jump back to earlier steps
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]); // Segments → step 1
    expect(screen.getByRole("button", { name: "Car" })).toBeInTheDocument();
  });

  it("reveals errors + stays put when Enter is pressed on an invalid step", () => {
    form.isStepValid = () => false;
    form.fieldErrors = { name: "Product name is required." };
    render(<ProductDialog {...props} editTarget={null} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.submit(screen.getByPlaceholderText("e.g. Fuchs 10W-40").closest("form")!);
    expect(form.touch).toHaveBeenCalledWith("name"); // revealed the step's fields
    expect(screen.getByPlaceholderText("e.g. Fuchs 10W-40")).toBeInTheDocument(); // did not advance
  });

  it("quantity hides the pack editor; error + busy disable Create", () => {
    form.error = "Something broke.";
    form.busy = true;
    const { rerender } = render(<ProductDialog {...props} editTarget={null} />);
    expect(screen.getByText("Something broke.")).toBeInTheDocument();
    next(); next();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByText("packs")).toBeInTheDocument();
    form.unit = "quantity";
    rerender(<ProductDialog {...props} editTarget={null} />);
    expect(screen.queryByText("packs")).not.toBeInTheDocument();
  });
});
