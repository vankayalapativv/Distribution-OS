import { describe, expect, it, vi } from "vitest";

const cat = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../lib/order/use-catalogue", () => ({ useCatalogue: () => cat.value }));

import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { CatalogueScreen } from "./catalogue-screen";

const make = () => ({
  availableBrands: ["Fuchs"],
  brand: "Fuchs",
  selectBrand: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  availableSegments: ["Car"],
  segmentFilter: null,
  setSegmentFilter: vi.fn(),
  filteredProducts: [{ id: "p1", productName: "Shell Helix", segments: ["Car"] }],
  setSheetProduct: vi.fn(),
  addOrOpen: vi.fn(),
  sheetProduct: null,
  defaultPack: 1,
  addFromSheet: vi.fn(),
});

const cart = (over: Record<string, unknown> = {}) =>
  ({ cart: {}, cartCount: 0, totalLines: 0, totalLitres: 0, setLineQty: vi.fn(), removeLine: vi.fn(), ...over }) as never;

describe("CatalogueScreen", () => {
  it("composes the catalogue (header + list), no Cart shortcut when empty", () => {
    cat.value = make();
    render(<CatalogueScreen customerName="Acme" products={[]} creditUnknown={false} cart={cart()} onReview={vi.fn()} />);
    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.queryByText(/Cart ·/)).not.toBeInTheDocument();
  });

  it("shows the offline banner + the Cart shortcut and reviews / goes back", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear?.();
    cat.value = make();
    const onReview = vi.fn();
    render(<CatalogueScreen products={[]} creditUnknown={false} cart={cart({ cartCount: 2 })} onReview={onReview} offline />);
    expect(screen.getByText("Checking credit…")).toBeInTheDocument(); // subtitle fallback (no customerName)
    fireEvent.click(screen.getByText("Cart · 2"));
    expect(onReview).toHaveBeenCalled();
    fireEvent.click(screen.getByText("←"));
    expect(router.back).toHaveBeenCalled();
  });

  it("opens the pack sheet for the selected product: remove a line, then Add", () => {
    const value = make();
    value.sheetProduct = { id: "p1", productName: "Shell Helix", segments: ["Car", "2W"], packSizes: [1], unit: "litres" } as never;
    value.filteredProducts = []; // empty list so the only ✕ is the sheet's line
    cat.value = value;
    const removeLine = vi.fn();
    render(
      <CatalogueScreen
        products={[]}
        creditUnknown={false}
        cart={cart({ cart: { p1: [{ packSizeLitres: 1, quantityUnits: 2 }] }, removeLine })}
        onReview={vi.fn()}
      />,
    );
    expect(screen.getByText("Shell Helix")).toBeInTheDocument(); // the pack sheet heading
    fireEvent.click(screen.getByText("✕")); // the sheet line's remove → onRemoveLine
    expect(removeLine).toHaveBeenCalledWith("p1", 0);
    fireEvent.click(screen.getByText("Add")); // → addFromSheet + onClose(setSheetProduct null)
    expect(value.addFromSheet).toHaveBeenCalled();
    expect(value.setSheetProduct).toHaveBeenCalledWith(null);
  });

  it("opens the pack sheet with no existing lines (empty cart for that product)", () => {
    const value = make();
    value.sheetProduct = { id: "p1", productName: "Shell Helix", segments: ["Car"], packSizes: [1], unit: "litres" } as never;
    value.filteredProducts = [];
    cat.value = value;
    render(<CatalogueScreen products={[]} creditUnknown={false} cart={cart({ cart: {} })} onReview={vi.fn()} />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument(); // sheet open, no line rows
  });
});
