import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductsDialogsState } from "./use-products-dialogs";

// Function declaration (hoisted) so the hoisted vi.mock factories can reference it.
// Each dialog, when open, renders a close (onOpenChange false) + keep (true) button.
function dlg(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Mock = ({ open, target, onOpenChange }: any) => (open || target) ? (
    <span>
      <button data-testid={`${id}-close`} onClick={() => onOpenChange(false)} />
      <button data-testid={`${id}-keep`} onClick={() => onOpenChange(true)} />
    </span>
  ) : null;
  Mock.displayName = id;
  return Mock;
}
vi.mock("./product-create-dialog", () => ({ ProductDialog: dlg("product"), ProductDeleteDialog: dlg("product-del") }));

import { ProductsDialogs } from "./products-dialogs";

const config = { apiBaseUrl: "", authToken: "" };
const state = (over: Partial<ProductsDialogsState> = {}): ProductsDialogsState =>
  ({
    productCreateOpen: false, setProductCreateOpen: vi.fn(), productEdit: null, setProductEdit: vi.fn(), productDelete: null, setProductDelete: vi.fn(),
    handleAdd: vi.fn(), ...over,
  } as ProductsDialogsState);

describe("ProductsDialogs", () => {
  it("renders nothing when everything is closed", () => {
    render(<ProductsDialogs d={state()} actionConfig={config} />);
    expect(screen.queryByTestId("product-close")).not.toBeInTheDocument();
  });

  it("resets the create+edit flags on close (and keeps them open otherwise)", () => {
    const d = state({ productCreateOpen: true });
    render(<ProductsDialogs d={d} actionConfig={config} />);
    // keep (onOpenChange true) must NOT reset; close (false) resets it.
    fireEvent.click(screen.getByTestId("product-keep"));
    fireEvent.click(screen.getByTestId("product-close"));
    expect(d.setProductCreateOpen).toHaveBeenCalledTimes(1); // only the close reset it
    expect(d.setProductEdit).toHaveBeenCalledWith(null);
  });

  it("opens the edit dialog via the other operand too", () => {
    const d = state({ productEdit: { id: "p" } as never });
    render(<ProductsDialogs d={d} actionConfig={config} />);
    expect(screen.getByTestId("product-close")).toBeInTheDocument();
  });

  it("clears the delete target on close", () => {
    const d = state({ productDelete: { id: "p" } as never });
    render(<ProductsDialogs d={d} actionConfig={config} />);
    fireEvent.click(screen.getByTestId("product-del-keep")); // guard: no clear
    fireEvent.click(screen.getByTestId("product-del-close"));
    expect(d.setProductDelete).toHaveBeenCalledTimes(1);
    expect(d.setProductDelete).toHaveBeenCalledWith(null);
  });
});
