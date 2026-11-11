import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/format", () => ({ rupees: (n: number) => `₹${n}` }));

import { OpeningBalanceFields } from "./opening-balance-fields";
import type { OpeningBalance } from "./opening-balance-logic";

const ob = (): OpeningBalance => ({
  id: "o1",
  asOfDate: "2026-03-31",
  openingAmount: 1000,
  amountCollected: 200,
  outstandingAmount: 800,
  remarks: null,
});

const base = {
  busy: false,
  amount: "",
  setAmount: vi.fn(),
  asOfDate: "2026-03-31",
  setAsOfDate: vi.fn(),
  remarks: "",
  setRemarks: vi.fn(),
};

describe("OpeningBalanceFields", () => {
  it("shows the existing-balance summary and the lock note when locked", () => {
    render(<OpeningBalanceFields {...base} initial={ob()} locked />);
    expect(screen.getByText("₹200")).toBeInTheDocument();
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText(/Only a Super Admin can edit or clear it/)).toBeInTheDocument();
  });

  it("omits the summary + lock note when creating a fresh balance", () => {
    render(<OpeningBalanceFields {...base} initial={null} locked={false} />);
    expect(screen.queryByText("Collected so far")).not.toBeInTheDocument();
    expect(screen.queryByText(/Only a Super Admin/)).not.toBeInTheDocument();
  });

  it("sanitizes the amount input to digits + dot", () => {
    const setAmount = vi.fn();
    render(<OpeningBalanceFields {...base} initial={null} locked={false} setAmount={setAmount} />);
    fireEvent.change(screen.getByLabelText("Opening amount (₹)"), { target: { value: "1a2.b5" } });
    expect(setAmount).toHaveBeenCalledWith("12.5");
  });

  it("wires the date + remarks inputs", () => {
    const setAsOfDate = vi.fn();
    const setRemarks = vi.fn();
    render(<OpeningBalanceFields {...base} initial={null} locked={false} setAsOfDate={setAsOfDate} setRemarks={setRemarks} />);
    fireEvent.change(screen.getByLabelText("As of date"), { target: { value: "2026-01-01" } });
    expect(setAsOfDate).toHaveBeenCalledWith("2026-01-01");
    fireEvent.change(screen.getByLabelText("Remarks (optional)"), { target: { value: "note" } });
    expect(setRemarks).toHaveBeenCalledWith("note");
  });
});
