import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/format", () => ({ rupeesExact: (n: number) => `₹${n}` }));

import { SalesReturnLines } from "./sales-return-lines";
import type { ReturnLine } from "./sales-return-edit-logic";

const line = (over: Partial<ReturnLine> = {}): ReturnLine => ({
  orderItemId: "oi1",
  kind: "oil",
  segment: "Cars",
  description: "Oil 5L",
  unitPrice: 100,
  returnableUnits: 5,
  ...over,
});

describe("SalesReturnLines", () => {
  it("shows the empty note when there are no lines", () => {
    render(<SalesReturnLines lines={[]} qty={{}} setQty={vi.fn()} />);
    expect(screen.getByText(/Nothing available to return/)).toBeInTheDocument();
  });

  it("renders each line with category + rate and edits the quantity", () => {
    // Apply the updater synchronously (a controlled input reverts under a mock setter).
    let next: Record<string, string> = {};
    const setQty = vi.fn((u: (s: Record<string, string>) => Record<string, string>) => {
      next = u({ oi1: "2" });
    });
    render(<SalesReturnLines lines={[line()]} qty={{ oi1: "2" }} setQty={setQty} />);
    expect(screen.getByText("Oil 5L")).toBeInTheDocument();
    expect(screen.getByText("Cars")).toBeInTheDocument();
    expect(screen.getByText("₹200")).toBeInTheDocument(); // line total 2×100

    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    expect(next).toEqual({ oi1: "3" });
  });

  it("omits the line total when the quantity is blank", () => {
    render(<SalesReturnLines lines={[line({ segment: null })]} qty={{}} setQty={vi.fn()} />);
    expect(screen.getByText("Oil")).toBeInTheDocument();
    expect(screen.getByText(/₹\d+/)).toBeInTheDocument(); // rate still shows; no crash
  });
});
