import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ManagedProduct } from "./products-api";

const form = {
  productName: "Fuchs", setProductName: vi.fn(),
  brand: "Fuchs", setBrand: vi.fn(),
  hsnCode: "2710", setHsnCode: vi.fn(),
  unit: "litres" as "litres" | "quantity", setUnit: vi.fn(),
  segments: ["Car"] as string[], toggleSegment: vi.fn(),
  packs: [] as unknown[], setPacks: vi.fn(),
  busy: false, error: null as string | null,
  // Error model — seeded valid so steps advance and Create/Save are enabled.
  fieldErrors: {} as Record<string, string>,
  touched: {} as Record<string, boolean>,
  touch: vi.fn(),
  isStepValid: () => true,
  allValid: true,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => {
    e.preventDefault();
    return { ok: true };
  }),
};
vi.mock("./use-product-form", () => ({ useProductForm: () => form }));
vi.mock("./brand-field", () => ({
  // type="button" mirrors the real combobox trigger — inside the wizard's <form>
  // a bare button would default to submit and advance a step.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BrandField: ({ onChange }: any) => <button type="button" onClick={() => onChange("Shell")}>brand</button>,
}));
vi.mock("./pack-rows", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PackRows: ({ onChange }: any) => <button type="button" onClick={() => onChange([])}>packs</button>,
}));

import { ProductDialog } from "./product-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), actionConfig: config };

describe("ProductDialog", () => {
  const nextStep = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  it("adds via a guided wizard: details, then segment chips, then packs + Create", () => {
    render(<ProductDialog {...props} editTarget={null} />);
    expect(screen.getByText("Add product")).toBeInTheDocument();
    // Step 1 (details): name is here, segment chips are not yet.
    expect(screen.getByPlaceholderText("e.g. Fuchs 10W-40")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gear Oil" })).not.toBeInTheDocument();
    // Step 2 (classification): the segment chips appear.
    nextStep();
    expect(screen.getByRole("button", { name: "Car" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gear Oil" })).toBeInTheDocument();
    // Step 3 (packs & pricing): the pack editor + the Create action.
    nextStep();
    expect(screen.getByText("packs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeInTheDocument();
  });

  it("titles Edit for an existing target and Cancel closes it", () => {
    const onOpenChange = vi.fn();
    render(<ProductDialog {...props} onOpenChange={onOpenChange} editTarget={{ id: "p1" } as unknown as ManagedProduct} />);
    expect(screen.getByText("Edit product")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("field, chip and pack edits across the steps reach the form hook; Create submits", () => {
    render(<ProductDialog {...props} editTarget={null} />);
    // Step 1 — details.
    fireEvent.change(screen.getByPlaceholderText("e.g. Fuchs 10W-40"), { target: { value: "Shell 20W50" } });
    expect(form.setProductName).toHaveBeenCalledWith("Shell 20W50");
    // HSN input strips non-digits before calling the hook.
    fireEvent.change(screen.getByPlaceholderText(/27101980/), { target: { value: "2710a1980" } });
    expect(form.setHsnCode).toHaveBeenCalledWith("27101980");
    fireEvent.click(screen.getByText("brand"));
    expect(form.setBrand).toHaveBeenCalledWith("Shell");
    // Step 2 — classification.
    nextStep();
    fireEvent.click(screen.getByRole("button", { name: "2W" }));
    expect(form.toggleSegment).toHaveBeenCalledWith("2W");
    // Step 3 — packs + Create.
    nextStep();
    fireEvent.click(screen.getByText("packs"));
    expect(form.setPacks).toHaveBeenCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    expect(form.handleSubmit).toHaveBeenCalled();
  });

  it("switches unit and hides pack rows for a quantity product", () => {
    const { rerender } = render(<ProductDialog {...props} editTarget={null} />);
    nextStep(); // step 2 holds the Sold-by toggle
    fireEvent.click(screen.getByRole("button", { name: "Quantity (pieces)" }));
    expect(form.setUnit).toHaveBeenCalledWith("quantity");
    nextStep(); // step 3
    // Litres (mock still litres) shows the pack editor…
    expect(screen.getByText("packs")).toBeInTheDocument();
    // …quantity hides it.
    form.unit = "quantity";
    rerender(<ProductDialog {...props} editTarget={null} />);
    expect(screen.queryByText("packs")).not.toBeInTheDocument();
    form.unit = "litres";
  });

  it("shows the form error and disables Create while busy", () => {
    form.error = "Brand is required.";
    form.busy = true;
    render(<ProductDialog {...props} editTarget={null} />);
    // The hook error shows on the current step…
    expect(screen.getByText("Brand is required.")).toBeInTheDocument();
    // …and the final Create action is disabled while saving.
    nextStep();
    nextStep();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    form.error = null;
    form.busy = false;
  });
});
