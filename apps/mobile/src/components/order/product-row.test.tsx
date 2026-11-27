import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductRow } from "./product-row";

const product = { id: "p1", productName: "Shell Helix", segments: ["Car", "2W"] } as never;
const line = (over: Record<string, unknown> = {}) => ({ packSizeLitres: 1, quantityUnits: 3, ...over }) as never;

const cbs = () => ({ onOpen: vi.fn(), onAdd: vi.fn(), onQty: vi.fn(), onRemove: vi.fn() });

describe("ProductRow", () => {
  it("no lines → Add button opens the add flow; name opens the pack sheet", () => {
    const c = cbs();
    render(<ProductRow product={product} lines={[]} {...c} />);
    expect(screen.getByText("Car · 2W")).toBeInTheDocument(); // segments subtitle
    fireEvent.click(screen.getByText("Add"));
    expect(c.onAdd).toHaveBeenCalledWith(product);
    fireEvent.click(screen.getByText("Shell Helix"));
    expect(c.onOpen).toHaveBeenCalledWith(product);
  });

  it("one line → pack subtitle, qty stepper + remove", () => {
    const c = cbs();
    render(<ProductRow product={product} lines={[line()]} {...c} />);
    expect(screen.getByText("1 L")).toBeInTheDocument(); // packLabel subtitle
    fireEvent.click(screen.getByText("＋"));
    expect(c.onQty).toHaveBeenCalledWith("p1", 0, "4");
    fireEvent.click(screen.getByText("✕"));
    expect(c.onRemove).toHaveBeenCalledWith("p1", 0);
  });

  it("one piece-sold line → 'By the piece' subtitle, blank qty when under 1", () => {
    render(<ProductRow product={product} lines={[line({ packSizeLitres: null, quantityUnits: 0 })]} {...cbs()} />);
    expect(screen.getByText("By the piece")).toBeInTheDocument();
    expect(screen.getByDisplayValue("")).toBeInTheDocument(); // quantityUnits < 1 → empty field
  });

  it("many lines → 'N packs · tap to edit'", () => {
    const c = cbs();
    render(<ProductRow product={product} lines={[line(), line({ packSizeLitres: 5 })]} {...c} />);
    expect(screen.getByText("2 packs")).toBeInTheDocument();
    fireEvent.click(screen.getByText("2 packs"));
    expect(c.onOpen).toHaveBeenCalledWith(product);
  });
});
