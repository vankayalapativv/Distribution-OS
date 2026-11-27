import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { LedgerHeader } from "./ledger-header";

describe("LedgerHeader", () => {
  it("renders the customer + Dr closing balance and goes back on tap", () => {
    (router.back as ReturnType<typeof vi.fn>).mockClear?.();
    render(<LedgerHeader customerName="Sri Traders" closingBalance={12000} pending={false} />);
    expect(screen.getByText("Sri Traders")).toBeInTheDocument();
    expect(screen.getByText(/12,000 Dr/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a Cr balance", () => {
    render(<LedgerHeader customerName="X" closingBalance={-500} pending={false} />);
    expect(screen.getByText(/500 Cr/)).toBeInTheDocument();
  });

  it("shimmers the balance while pending", () => {
    render(<LedgerHeader customerName="X" closingBalance={0} pending />);
    expect(screen.getByText("Closing balance")).toBeInTheDocument();
    expect(screen.queryByText(/Dr|Cr/)).not.toBeInTheDocument();
  });
});
