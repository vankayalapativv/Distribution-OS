import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }); Object.assign(form, defaults()); });
/* eslint-enable @typescript-eslint/no-explicit-any */

import { ProductDialog } from "./product-dialog";

const props = { open: true, onOpenChange: vi.fn(), actionConfig: config };
const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

describe("ProductDialog — wizard submit", () => {
  it("on a failed save, jumps to + focuses the offending field's step", async () => {
    form.handleSubmit = vi.fn(async (e: { preventDefault: () => void }) => { e.preventDefault(); return { ok: false, field: "segments" } as const; });
    render(<ProductDialog {...props} editTarget={null} />);
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    await waitFor(() => expect(form.touch).toHaveBeenCalledWith("segments"));
    expect(screen.getByRole("button", { name: "Car" })).toBeInTheDocument(); // jumped to step 1
  });

  it("Enter on an invalid step with no field error touches but focuses nothing", () => {
    form.isStepValid = () => false;
    form.fieldErrors = {}; // invalid step, yet no specific field flagged
    render(<ProductDialog {...props} editTarget={null} />);
    fireEvent.submit(screen.getByPlaceholderText("e.g. Fuchs 10W-40").closest("form")!);
    expect(form.touch).toHaveBeenCalledWith("name");
    expect(screen.getByPlaceholderText("e.g. Fuchs 10W-40")).toBeInTheDocument(); // stayed put
  });

  it("a successful final submit closes without jumping to a field", async () => {
    render(<ProductDialog {...props} editTarget={null} />);
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    await waitFor(() => expect(form.handleSubmit).toHaveBeenCalled());
    expect(screen.getByText("packs")).toBeInTheDocument(); // still on step 2, no jump
  });

  it("a failed save with no field stays put without jumping", async () => {
    form.handleSubmit = vi.fn(async (e: { preventDefault: () => void }) => { e.preventDefault(); return { ok: false } as const; });
    render(<ProductDialog {...props} editTarget={null} />);
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    await waitFor(() => expect(form.handleSubmit).toHaveBeenCalled());
    expect(screen.getByText("packs")).toBeInTheDocument();
  });
});
