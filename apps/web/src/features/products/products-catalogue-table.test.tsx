import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/page-header", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageHeader: ({ subtitle, action }: any) => <div><div>{subtitle}</div>{action}</div>,
}));
vi.mock("@/components/data-table/data-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ empty }: any) => <div data-testid="table">{empty}</div>,
}));

const hook = {
  search: "", setSearch: vi.fn(), appliedSearch: "",
  columns: [1, 2], skeleton: [1, 2], noun: "oil",
  table: {}, total: 5, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null as { message: string } | null,
};
vi.mock("./use-catalogue-table", () => ({ useCatalogueTable: () => hook }));

import { CatalogueTable } from "./products-catalogue-table";

const config = { apiBaseUrl: "", authToken: "" };
const props = {
  category: "oils" as const, actionConfig: config, canManage: true, onAdd: vi.fn(),
  onEditProduct: vi.fn(), onDeleteProduct: vi.fn(),
};

describe("CatalogueTable", () => {
  it("shows the count, the Bulk Import + Add buttons, and wires search", () => {
    render(<CatalogueTable {...props} />);
    expect(screen.getByText("5 products")).toBeInTheDocument();
    expect(screen.getByText("Bulk Import")).toBeInTheDocument(); // opens the import dialog on click
    fireEvent.click(screen.getByText("+ Add product"));
    fireEvent.change(screen.getByPlaceholderText("Search by name, brand, or code…"), { target: { value: "5w" } });
    expect(props.onAdd).toHaveBeenCalled();
    expect(hook.setSearch).toHaveBeenCalledWith("5w");
    // No export/kebab any more.
    expect(screen.queryByTitle("Actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Download as PDF")).not.toBeInTheDocument();
  });

  it("hides Add + Bulk Import for a read-only accountant", () => {
    render(<CatalogueTable {...props} canManage={false} />);
    expect(screen.queryByText("+ Add product")).not.toBeInTheDocument();
    expect(screen.queryByText("Bulk Import")).not.toBeInTheDocument();
  });

  it("shows the empty create prompt, and the search-empty message", () => {
    hook.appliedSearch = "";
    const { rerender } = render(<CatalogueTable {...props} />);
    expect(screen.getByText(/Add your first product/)).toBeInTheDocument();
    hook.appliedSearch = "zzz";
    rerender(<CatalogueTable {...props} />);
    expect(screen.getByText("No products match your search.")).toBeInTheDocument();
    hook.appliedSearch = "";
  });

  it("shows an error banner from the table", () => {
    hook.error = { message: "Could not load products." };
    render(<CatalogueTable {...props} />);
    expect(screen.getByText("Could not load products.")).toBeInTheDocument();
    hook.error = null;
  });
});
