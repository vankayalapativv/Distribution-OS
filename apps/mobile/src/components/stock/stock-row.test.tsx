import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StockRow } from "./stock-row";
import type { StockGodown, StockProduct } from "../../lib/stock";

const godowns: StockGodown[] = [
  { id: "g1", name: "Main" },
  { id: "g2", name: "Branch" },
];

const product = (over: Partial<StockProduct> = {}): StockProduct => ({
  productId: "p1",
  productName: "Shell Helix",
  brand: "Shell",
  segment: "Car",
  unit: "litres",
  totalUnits: 1150,
  packs: [
    {
      packSizeLitres: 1,
      totalUnits: 1000,
      byGodown: [
        { locationId: "g1", qtyUnits: 1000 },
        { locationId: "g2", qtyUnits: 0 }, // dimmed
        { locationId: "gX", qtyUnits: 5 }, // unknown → "Godown" fallback
      ],
    },
    {
      packSizeLitres: 20,
      totalUnits: 150,
      byGodown: [{ locationId: "g1", qtyUnits: 150 }],
    },
  ],
  ...over,
});

describe("StockRow", () => {
  it("renders the name, meta, total and a chip per pack (no godown split until tapped)", () => {
    render(<StockRow product={product()} godowns={godowns} />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText("Car · Shell")).toBeInTheDocument();
    expect(screen.getByText("1,150")).toBeInTheDocument(); // total units, grouped
    expect(screen.getByText("1 L")).toBeInTheDocument(); // pack chip
    expect(screen.getByText("20 L")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument(); // pack on-hand count
    // Collapsed: no per-godown split yet.
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("expands a pack to its per-godown split (dimming zeros, unknown → fallback) and toggles closed", () => {
    render(<StockRow product={product()} godowns={godowns} />);
    fireEvent.click(screen.getByText("1 L"));
    expect(screen.getByText("1 L · by godown")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument(); // zero-qty, dimmed
    expect(screen.getByText("Godown")).toBeInTheDocument(); // unknown locationId fallback
    expect(screen.getByText("—")).toBeInTheDocument(); // the zero rendered as a dash
    // Tap the same pack again → collapses.
    fireEvent.click(screen.getByText("1 L"));
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("switches the open pack when a different chip is tapped (one open at a time)", () => {
    render(<StockRow product={product()} godowns={godowns} />);
    fireEvent.click(screen.getByText("1 L"));
    expect(screen.getByText("1 L · by godown")).toBeInTheDocument();
    fireEvent.click(screen.getByText("20 L"));
    expect(screen.getByText("20 L · by godown")).toBeInTheDocument();
    expect(screen.queryByText("1 L · by godown")).not.toBeInTheDocument();
  });

  it("shows a piece-sold product's count in pcs and hides meta when brand/segment are absent", () => {
    render(
      <StockRow
        product={product({
          unit: "quantity",
          brand: null,
          segment: null,
          packs: [{ packSizeLitres: 1, totalUnits: 20, byGodown: [{ locationId: "g1", qtyUnits: 20 }] }],
        })}
        godowns={godowns}
      />,
    );
    expect(screen.queryByText(/·/)).not.toBeInTheDocument(); // no brand/segment meta line
    expect(screen.getByText("20")).toBeInTheDocument(); // count leads for pcs
    expect(screen.getByText("pcs")).toBeInTheDocument();
    fireEvent.click(screen.getByText("pcs"));
    expect(screen.getByText("pcs · by godown")).toBeInTheDocument();
  });
});
