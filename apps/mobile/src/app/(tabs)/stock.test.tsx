import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../components/stock/stock-screen", () => ({ StockScreen: () => <span>stock-screen</span> }));

import Stock from "./stock";

describe("SE Stock screen", () => {
  it("renders the shared stock screen", () => {
    render(<Stock />);
    expect(screen.getByText("stock-screen")).toBeInTheDocument();
  });
});
