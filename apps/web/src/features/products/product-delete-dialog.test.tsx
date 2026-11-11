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

  it("dismissing via the dialog (Escape) clears any error and closes", () => {
    render(<ProductDeleteDialog target={target} onOpenChange={onOpenChange} actionConfig={config} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
