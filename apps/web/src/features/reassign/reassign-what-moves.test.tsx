import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReassignWhatMoves } from "./reassign-what-moves";

const counts = { orders: 24, collections: 11, invoices: 23, visits: 38, photos: 9, notes: 5, beatDays: 2 };

describe("ReassignWhatMoves", () => {
  it("renders a tile per record type with the total in the header", () => {
    render(<ReassignWhatMoves counts={counts} />);
    expect(screen.getByText(/What moves \(112\)/)).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Beat days")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument(); // visits count
  });
});
