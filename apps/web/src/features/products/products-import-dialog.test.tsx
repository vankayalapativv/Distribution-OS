import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
let state: any;
const useProductsImport = vi.fn((..._a: unknown[]) => state);
vi.mock("./use-products-import", () => ({ useProductsImport: (...a: unknown[]) => useProductsImport(...a) }));
vi.mock("./products-import-review", () => ({ ProductsImportReview: () => <div data-testid="review" /> }));
vi.mock("@/components/import-ui", () => ({
  ImportDropzone: (p: any) => <button onClick={() => p.onFile(new File(["x"], "f.xlsx"))}>drop</button>,
  ImportSteps: (p: any) => <button onClick={p.onDownload}>steps-download</button>,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (p: any) => (
    <div>
      <button data-testid="oc-open" onClick={() => p.onOpenChange(true)} />
      <button data-testid="oc-close" onClick={() => p.onOpenChange(false)} />
      {p.open && p.children}
    </div>
  ),
  DialogContent: (p: any) => <div>{p.children}</div>,
  DialogBody: (p: any) => <div>{p.children}</div>,
  DialogHeader: (p: any) => <div>{p.children}</div>,
  DialogFooter: (p: any) => <div>{p.children}</div>,
  DialogTitle: (p: any) => <div>{p.children}</div>,
  DialogDescription: (p: any) => <div>{p.children}</div>,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { ProductsImportDialog } from "./products-import-dialog";

const cfg = { apiBaseUrl: "", authToken: "" };
const base = {
  rows: [] as unknown[], fileName: "", parsing: false, busy: false, error: null as string | null,
  done: null as string | null, ready: [] as unknown[], errCount: 0, totalPacks: 0,
  onFile: vi.fn(), confirm: vi.fn(), close: vi.fn(),
};
const show = (over = {}) => {
  state = { ...base, ...over };
  render(<ProductsImportDialog actionConfig={cfg} open onClose={vi.fn()} onDownloadTemplate={vi.fn()} />);
};

afterEach(() => vi.clearAllMocks());

describe("ProductsImportDialog", () => {
  it("shows steps + dropzone when no file, and disables Import with nothing ready", () => {
    show();
    expect(screen.getByText("steps-download")).toBeInTheDocument();
    fireEvent.click(screen.getByText("drop"));
    expect(base.onFile).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Import 0 products/ })).toBeDisabled();
  });

  it("shows the 'no products found' notice once a file is parsed to nothing", () => {
    show({ fileName: "f.xlsx" });
    expect(screen.getByText(/No products found/)).toBeInTheDocument();
  });

  it("shows error + done text", () => {
    show({ fileName: "f.xlsx", error: "boom", done: "Imported 2 products." });
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("Imported 2 products.")).toBeInTheDocument();
  });

  it("renders the review + confirms when rows are ready", () => {
    show({ fileName: "f.xlsx", rows: [{}], ready: [{}] });
    expect(screen.getByTestId("review")).toBeInTheDocument();
    const importBtn = screen.getByRole("button", { name: /Import 1 product$/ });
    expect(importBtn).toBeEnabled();
    fireEvent.click(importBtn);
    expect(base.confirm).toHaveBeenCalled();
  });

  it("shows the importing state (busy) with controls disabled", () => {
    show({ busy: true, rows: [{}], ready: [{}] });
    expect(screen.getByText("Importing…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("closes via the footer button and on dismiss, but not when opening", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByTestId("oc-close"));
    expect(base.close).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("oc-open")); // onOpenChange(true) → no close
    expect(base.close).toHaveBeenCalledTimes(2);
  });
});
