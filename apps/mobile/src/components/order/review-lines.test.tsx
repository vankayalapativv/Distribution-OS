import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewLines } from "./review-lines";

const products = [{ id: "p1", productName: "Shell Helix", segments: ["Car"] }] as never;

const cart = (over: Record<string, unknown> = {}) =>
  ({
    orderedProductIds: ["p1", "pX"],
    cart: {
      p1: [{ packSizeLitres: 1, quantityUnits: 3 }],
      pX: [{ packSizeLitres: null, quantityUnits: 0 }], // unknown product → id fallback + "By the piece", blank qty
    },
    setLineQty: vi.fn(),
    removeLine: vi.fn(),
    ...over,
  }) as never;

describe("ReviewLines", () => {
  it("lists cart lines (name + pack / piece), edits qty, removes, and adds more", () => {
    const c = cart();
    const onAddMore = vi.fn();
    render(<ReviewLines cart={c} products={products} onAddMore={onAddMore} />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText("pX")).toBeInTheDocument(); // unknown product falls back to its id
    expect(screen.getByText("1 L")).toBeInTheDocument();
    expect(screen.getByText("By the piece")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("＋")[0]); // bump first line's qty
    expect((c as any).setLineQty).toHaveBeenCalledWith("p1", 0, "4");
    fireEvent.click(screen.getAllByText("✕")[0]); // remove first line
    expect((c as any).removeLine).toHaveBeenCalledWith("p1", 0);
    fireEvent.click(screen.getByText("＋ Add more"));
    expect(onAddMore).toHaveBeenCalled();
  });
});
