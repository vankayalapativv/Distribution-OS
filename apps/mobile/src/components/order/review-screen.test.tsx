import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewScreen } from "./review-screen";

const cart = (over: Record<string, unknown> = {}) =>
  ({
    orderedProductIds: ["p1"],
    cart: { p1: [{ packSizeLitres: 1, quantityUnits: 3 }] },
    totalLines: 1,
    totalLitres: 3,
    canSubmit: true,
    setLineQty: vi.fn(),
    removeLine: vi.fn(),
    ...over,
  }) as never;

const products = [{ id: "p1", productName: "Shell Helix", segments: ["Car"] }] as never;

describe("ReviewScreen", () => {
  it("renders the lines + totals and submits", () => {
    const onSubmit = vi.fn();
    const onBack = vi.fn();
    render(
      <ReviewScreen cart={cart()} products={products} customerName="Acme" onBack={onBack} onSubmit={onSubmit} submitting={false} error={null} />,
    );
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText(/1 item · 3 L/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit order"));
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText("←"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows an error, and blocks/ spins submit while submitting or not submittable", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ReviewScreen cart={cart({ canSubmit: false })} products={products} onBack={() => {}} onSubmit={onSubmit} submitting={false} error="Pick a quantity" />,
    );
    expect(screen.getByText("Pick a quantity")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Submit order"));
    expect(onSubmit).not.toHaveBeenCalled(); // canSubmit false → disabled
    rerender(<ReviewScreen cart={cart()} products={products} onBack={() => {}} onSubmit={onSubmit} submitting error={null} />);
    expect(screen.queryByText("Submit order")).not.toBeInTheDocument(); // spinner instead
  });
});
