import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmountCell, CategoryCell } from "./expenditure-cells";
import type { Expenditure } from "./expenditures-api";

const entry = (over: Partial<Expenditure> = {}): Expenditure => ({
  id: "e1", expenditureCode: "EXP-1", expenditureDate: "2026-07-18", categoryId: "c1",
  categoryName: "Rent", type: "compulsory", amount: 5000, paymentMode: null, paidTo: "Landlord",
  userId: null, userName: null, remarks: null, hasBill: true, createdAt: "", ...over,
});

describe("CategoryCell", () => {
  it("shows the category and an optional paid-to line", () => {
    const { rerender } = render(<CategoryCell entry={entry()} />);
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Landlord")).toBeInTheDocument();
    rerender(<CategoryCell entry={entry({ paidTo: null })} />);
    expect(screen.queryByText("Landlord")).not.toBeInTheDocument();
  });
});

describe("AmountCell", () => {
  it("shows the amount and a paperclip only when a bill is attached", () => {
    const { rerender } = render(<AmountCell entry={entry()} />);
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByTitle("Bill attached")).toBeInTheDocument();
    rerender(<AmountCell entry={entry({ hasBill: false })} />);
    expect(screen.queryByTitle("Bill attached")).not.toBeInTheDocument();
  });
});
