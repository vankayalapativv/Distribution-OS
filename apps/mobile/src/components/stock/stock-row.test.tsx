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
  totalUnits: 150,
  packs: [
    {
      packSizeLitres: 1,
      totalUnits: 150,
      byGodown: [
        { locationId: "g1", qtyUnits: 150 },
        { locationId: "g2", qtyUnits: 0 }, // dimmed
        { locationId: "gX", qtyUnits: 5 }, // unknown → "Godown" fallback
      ],
    },
  ],
  ...over,
});

describe("StockRow", () => {
  it("renders collapsed (name, meta, total) and expands pack + godown rows on tap", () => {
    render(<StockRow product={product()} godowns={godowns} />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText("Car · Shell")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    // Collapsed: no godown detail yet.
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Shell Helix"));
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("Godown")).toBeInTheDocument(); // unknown locationId fallback
    expect(screen.getByText(/150 u · 150 L/)).toBeInTheDocument(); // litres pack total
  });

  it("renders a piece-sold product's totals in pcs, and hides meta when absent", () => {
    render(
      <StockRow
        product={product({ unit: "quantity", brand: null, segment: null, packs: [{ packSizeLitres: 1, totalUnits: 20, byGodown: [] }] })}
        godowns={godowns}
      />,
    );
    expect(screen.queryByText(/·/)).not.toBeInTheDocument(); // no brand/segment meta line
    fireEvent.click(screen.getByText("Shell Helix"));
    expect(screen.getByText("20 pcs")).toBeInTheDocument();
  });
});
