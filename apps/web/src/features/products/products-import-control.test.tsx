import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const dl = vi.fn().mockResolvedValue(undefined);
vi.mock("./products-import", () => ({ downloadProductsTemplate: (...a: unknown[]) => dl(...a) }));
vi.mock("./products-import-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ProductsImportDialog: (p: any) => (
    <div data-testid="import-dialog">
      <button onClick={p.onDownloadTemplate}>dl</button>
      <button onClick={p.onClose}>close</button>
    </div>
  ),
}));

import { ProductsImportControl } from "./products-import-control";

const cfg = { apiBaseUrl: "", authToken: "" };

describe("ProductsImportControl", () => {
  it("opens the dialog from the ⋮ menu, downloads the template with the brands, and closes", async () => {
    render(<ProductsImportControl actionConfig={cfg} brandOptions={["Fuchs", "Savsol"]} />);
    expect(screen.queryByTestId("import-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("More actions"));
    fireEvent.click(screen.getByText("Bulk Import"));
    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("dl"));
    await waitFor(() => expect(dl).toHaveBeenCalledWith(["Fuchs", "Savsol"]));

    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("import-dialog")).not.toBeInTheDocument();
  });
});
