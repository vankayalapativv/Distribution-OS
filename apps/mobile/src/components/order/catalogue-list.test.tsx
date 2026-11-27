import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CatalogueList } from "./catalogue-list";

const product = (id: string, name: string) => ({ id, productName: name, segments: ["Car"] }) as never;
const cart = (over: Record<string, unknown> = {}) =>
  ({ cart: {}, setLineQty: vi.fn(), removeLine: vi.fn(), ...over }) as never;

describe("CatalogueList", () => {
  it("renders a row per product and surfaces Add", () => {
    const onAddOrOpen = vi.fn();
    render(
      <CatalogueList
        products={[product("p1", "Shell Helix"), product("p2", "Castrol GTX")]}
        cart={cart()}
        onOpen={vi.fn()}
        onAddOrOpen={onAddOrOpen}
      />,
    );
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText("Castrol GTX")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Add")[0]);
    expect(onAddOrOpen).toHaveBeenCalled();
  });

  it("shows the empty message when no products match", () => {
    render(<CatalogueList products={[]} cart={cart()} onOpen={vi.fn()} onAddOrOpen={vi.fn()} />);
    expect(screen.getByText("No products match your search.")).toBeInTheDocument();
  });
});
