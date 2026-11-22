import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/components/import-ui", () => ({
  ImportSummary: (p: any) => <div>summary:{p.ready}/{p.errors}/{p.total}</div>,
  ImportTotals: (p: any) => <div>totals:{p.items[0].value} {p.items[0].label}</div>,
  ReviewTable: (p: any) => <table><tbody>{p.children}</tbody></table>,
  ImportStatusBadge: (p: any) => <span data-ok={String(p.ok)}>{p.children}</span>,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { ProductsImportReview } from "./products-import-review";
import type { ProductReviewRow } from "./products-import";

const prod = (over = {}) => ({ productName: "P", brand: "Fuchs", hsnCode: "27101980", unit: "litres", segments: ["Car"], packs: [{ packSize: 5 }], ...over });
const rows: ProductReviewRow[] = [
  { product: prod({ productName: "Ready Oil" }), error: null },
  { product: prod({ productName: "Bad Oil", packs: [] }), error: "Add at least one pack size." },
  { product: prod({ productName: "Quantity Item", unit: "quantity", packs: [] }), error: null },
  { product: prod({ productName: "No Packs", packs: [] }), error: null },
  { product: prod({ productName: "Imported Oil" }), error: null, serverError: null },
  { product: prod({ productName: "Bare", brand: "", segments: [] }), error: null },
  { product: prod({ productName: "No HSN", hsnCode: "" }), error: null },
] as ProductReviewRow[];

describe("ProductsImportReview", () => {
  it("summarises and renders each row's packs, fallbacks and status", () => {
    render(<ProductsImportReview rows={rows} readyCount={6} errCount={1} totalPacks={2} />);
    expect(screen.getByText("summary:6/1/7")).toBeInTheDocument();
    expect(screen.getByText("totals:2 packs")).toBeInTheDocument();

    expect(screen.getAllByText("5L").length).toBeGreaterThan(0);        // litres pack list
    expect(screen.getByText("Add at least one pack size.")).toBeInTheDocument(); // client error
    expect(screen.getByText("piece (sold each)")).toBeInTheDocument();  // quantity
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);         // no-packs + bare fallbacks

    const badges = screen.getAllByText(/Ready|Error|Imported/);
    const labels = badges.map((b) => b.textContent);
    expect(labels).toContain("Error");
    expect(labels).toContain("Imported");
    expect(labels).toContain("Ready");
  });
});
