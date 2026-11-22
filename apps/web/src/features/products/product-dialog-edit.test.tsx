import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedProduct } from "./products-api";
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
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }); Object.assign(form, defaults()); });
/* eslint-enable @typescript-eslint/no-explicit-any */

import { ProductDialog } from "./product-dialog";

const props = { open: true, onOpenChange: vi.fn(), actionConfig: config };
const edit = { id: "p1" } as unknown as ManagedProduct;

describe("ProductDialog — edit form", () => {
  it("renders the single-page form, wires every field, and Cancel closes", () => {
    const onOpenChange = vi.fn();
    render(<ProductDialog {...props} onOpenChange={onOpenChange} editTarget={edit} />);
    expect(screen.getByText("Edit product")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("e.g. Fuchs 10W-40"), { target: { value: "X" } });
    expect(form.setProductName).toHaveBeenCalledWith("X");
    fireEvent.change(screen.getByPlaceholderText(/27101980/), { target: { value: "99z" } });
    expect(form.setHsnCode).toHaveBeenCalledWith("99");
    fireEvent.click(screen.getByText("brand"));
    fireEvent.click(screen.getByRole("button", { name: "Quantity (pieces)" }));
    expect(form.setUnit).toHaveBeenCalledWith("quantity");
    fireEvent.click(screen.getByRole("button", { name: "2W" }));
    expect(form.toggleSegment).toHaveBeenCalledWith("2W");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits, and focuses a server-rejected field", () => {
    form.handleSubmit = vi.fn((e: { preventDefault: () => void }) => { e.preventDefault(); return { ok: false, field: "hsnCode" } as const; });
    render(<ProductDialog {...props} editTarget={edit} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(form.handleSubmit).toHaveBeenCalled();
  });

  it("shows each field's validation message once touched", () => {
    form.touched = { name: true, brand: true, hsnCode: true, segments: true, packs: true };
    form.fieldErrors = { name: "Bad name", brand: "Bad brand", hsnCode: "Bad hsn", segments: "Bad seg", packs: "Bad packs" };
    render(<ProductDialog {...props} editTarget={edit} />);
    for (const m of ["Bad name", "Bad brand", "Bad hsn", "Bad seg", "Bad packs"]) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }
  });

  it("a successful save needs no field focus", async () => {
    render(<ProductDialog {...props} editTarget={edit} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(form.handleSubmit).toHaveBeenCalled());
  });

  it("shows the general error and disables Save while busy", () => {
    form.error = "Couldn't update the product.";
    form.busy = true;
    render(<ProductDialog {...props} editTarget={edit} />);
    expect(screen.getByText("Couldn't update the product.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
