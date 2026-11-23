import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useCan = vi.fn(() => true);
vi.mock("@/features/shell/use-can", () => ({ useCan: (...a: unknown[]) => useCan(...(a as [])) }));
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

afterEach(() => useCan.mockReset());

describe("ProductsList", () => {
  it("renders the catalogue + dialogs and lets a user with products.manage add", () => {
    useCan.mockReturnValue(true);
    render(<ProductsList role="MANAGER" actionConfig={config} />);
    expect(useCan).toHaveBeenCalledWith("action:products.manage");
    expect(screen.getByTestId("catalogue").textContent).toContain("manage:true");
    expect(screen.getByTestId("dialogs")).toBeInTheDocument();
    fireEvent.click(screen.getByText("add"));
    expect(handleAdd).toHaveBeenCalled();
  });

  it("makes the catalogue read-only without the products.manage capability", () => {
    useCan.mockReturnValue(false);
    render(<ProductsList role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByTestId("catalogue").textContent).toContain("manage:false");
  });
});
