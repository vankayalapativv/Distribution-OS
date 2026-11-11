import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: unknown) => C }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./products-dialogs", () => ({ ProductsDialogs: () => <div data-testid="dialogs" /> }));
vi.mock("./products-catalogue-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CatalogueTable: ({ canManage, onAdd }: any) => (
    <div data-testid="catalogue">manage:{String(canManage)}<button onClick={onAdd}>add</button></div>
  ),
}));
const handleAdd = vi.fn();
vi.mock("./use-products-dialogs", () => ({ useProductsDialogs: () => ({ handleAdd, setProductEdit: vi.fn(), setProductDelete: vi.fn() }) }));

import { ProductsList } from "./products-list";

const config = { apiBaseUrl: "", authToken: "" };

describe("ProductsList", () => {
  it("renders the catalogue + dialogs and lets managers add", () => {
    render(<ProductsList role="MANAGER" actionConfig={config} />);
    expect(screen.getByTestId("catalogue").textContent).toContain("manage:true");
    expect(screen.getByTestId("dialogs")).toBeInTheDocument();
    fireEvent.click(screen.getByText("add"));
    expect(handleAdd).toHaveBeenCalled();
  });

  it("makes the catalogue read-only for an accountant", () => {
    render(<ProductsList role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByTestId("catalogue").textContent).toContain("manage:false");
  });
});
