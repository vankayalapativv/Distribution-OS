import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./brand-field", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BrandField: ({ onChange }: any) => <button type="button" onClick={() => onChange("Shell")}>brand</button>,
}));

import { ProductBrandFieldRow, ProductHsnField, ProductNameField } from "./product-core-fields";
import type { ProductForm } from "./use-product-form";

const cfg = { apiBaseUrl: "", authToken: "" };
const mk = (over: Partial<ProductForm> = {}) =>
  ({ productName: "Fuchs", setProductName: vi.fn(), brand: "Fuchs", setBrand: vi.fn(),
     hsnCode: "2710", setHsnCode: vi.fn(), touch: vi.fn(), fieldErrors: {}, touched: {}, ...over } as unknown as ProductForm);

describe("ProductNameField", () => {
  it("edits the name + touches, and shows the error only when touched", () => {
    const f = mk({ fieldErrors: { name: "Required." }, touched: { name: true } });
    render(<ProductNameField f={f} idPrefix="edit-err" inputRef={createRef()} autoFocus />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Fuchs 10W-40"), { target: { value: "X" } });
    expect(f.setProductName).toHaveBeenCalledWith("X");
    expect(f.touch).toHaveBeenCalledWith("name");
    expect(screen.getByText("Required.")).toBeInTheDocument();
  });
});

describe("ProductHsnField", () => {
  it("strips non-digits and shows a touched error", () => {
    const f = mk({ fieldErrors: { hsnCode: "8 digits." }, touched: { hsnCode: true } });
    render(<ProductHsnField f={f} idPrefix="err" inputRef={createRef()} />);
    fireEvent.change(screen.getByPlaceholderText(/27101980/), { target: { value: "99a" } });
    expect(f.setHsnCode).toHaveBeenCalledWith("99");
    fireEvent.blur(screen.getByPlaceholderText(/27101980/));
    expect(f.touch).toHaveBeenCalledWith("hsnCode");
    expect(screen.getByText("8 digits.")).toBeInTheDocument();
  });
});

describe("ProductBrandFieldRow", () => {
  it("forwards the brand change + touch", () => {
    const f = mk();
    render(<ProductBrandFieldRow f={f} idPrefix="err" wrapRef={createRef()} actionConfig={cfg} />);
    fireEvent.click(screen.getByText("brand"));
    expect(f.setBrand).toHaveBeenCalledWith("Shell");
    expect(f.touch).toHaveBeenCalledWith("brand");
  });
});
