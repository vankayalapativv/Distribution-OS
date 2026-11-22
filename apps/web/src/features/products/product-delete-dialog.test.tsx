import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedProduct } from "./products-api";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Dialog: (p: any) => (
    <div>
      <button data-testid="oc-open" onClick={() => p.onOpenChange(true)} />
      <button data-testid="oc-close" onClick={() => p.onOpenChange(false)} />
      {p.open && p.children}
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogContent: (p: any) => <div>{p.children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogBody: (p: any) => <div>{p.children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogHeader: (p: any) => <div>{p.children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogFooter: (p: any) => <div>{p.children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogTitle: (p: any) => <div>{p.children}</div>,
}));

import { ProductDeleteDialog } from "./product-delete-dialog";

const target = { id: "p1", productName: "Fuchs 10W40" } as unknown as ManagedProduct;
const config = { apiBaseUrl: "", authToken: "" };
const onOpenChange = vi.fn();

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("ProductDeleteDialog", () => {
  it("stays closed with no target", () => {
    render(<ProductDeleteDialog target={null} onOpenChange={onOpenChange} actionConfig={config} />);
    expect(screen.queryByText("Delete product")).not.toBeInTheDocument();
  });

  it("names the product and DELETEs it, then closes", async () => {
    apiRequest.mockResolvedValueOnce(undefined);
    render(<ProductDeleteDialog target={target} onOpenChange={onOpenChange} actionConfig={config} />);
    expect(screen.getByText("Fuchs 10W40")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(config, "DELETE", "/products/p1"));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["products"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the API error and keeps the dialog open", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Used in orders"));
    render(<ProductDeleteDialog target={target} onOpenChange={onOpenChange} actionConfig={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByText("Used in orders")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cancel closes without calling the API", () => {
    render(<ProductDeleteDialog target={target} onOpenChange={onOpenChange} actionConfig={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("forwards both open-change directions (clearing the error only on close)", () => {
    render(<ProductDeleteDialog target={target} onOpenChange={onOpenChange} actionConfig={config} />);
    fireEvent.click(screen.getByTestId("oc-open"));   // next=true → no setError, forwards true
    fireEvent.click(screen.getByTestId("oc-close"));  // next=false → clears error, forwards false
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
  });
});
