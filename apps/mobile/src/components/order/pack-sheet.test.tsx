import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PackSheet } from "./pack-sheet";

const product = (over: Record<string, unknown> = {}) =>
  ({ id: "p1", productName: "Shell Helix", segments: ["Car", "2W"], packSizes: [1, 5], unit: "litres", ...over }) as never;

const base = {
  product: product(),
  lines: [],
  defaultPack: 1,
  onClose: vi.fn(),
  onAdd: vi.fn(),
  onRemoveLine: vi.fn(),
};

describe("PackSheet", () => {
  it("renders nothing when no product is selected", () => {
    render(<PackSheet {...base} product={null} />);
    expect(screen.queryByText("Shell Helix")).not.toBeInTheDocument();
  });

  it("adds a litres line with the seeded pack and closes", () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<PackSheet {...base} onAdd={onAdd} onClose={onClose} />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith(1, "Car", 1); // seeded pack 1, first segment, qty 1
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks Add for a litres product with no pack chosen", () => {
    const onAdd = vi.fn();
    render(<PackSheet {...base} product={product({ packSizes: [1, 5] })} defaultPack={null} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled(); // no pack → invalid
  });

  it("adds a piece-sold product with no pack and seeds a null segment when none", () => {
    const onAdd = vi.fn();
    const { rerender } = render(<PackSheet {...base} product={product({ unit: "quantity" })} defaultPack={null} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith(null, "Car", 1);
    onAdd.mockClear();
    rerender(<PackSheet {...base} product={product({ unit: "quantity", segments: [] })} defaultPack={null} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith(null, null, 1); // no segments → null
  });

  it("blocks Add for a litres product when the pack size is zero", () => {
    const onAdd = vi.fn();
    render(<PackSheet {...base} product={product({ packSizes: [0] })} defaultPack={0} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled(); // pack 0 is not > 0 → invalid
  });

  it("blocks Add when the quantity is invalid", () => {
    const onAdd = vi.fn();
    render(<PackSheet {...base} product={product({ unit: "quantity" })} onAdd={onAdd} />);
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "x" } }); // invalid qty
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
