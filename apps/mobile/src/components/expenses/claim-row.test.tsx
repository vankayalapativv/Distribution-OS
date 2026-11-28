import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClaimRow } from "./claim-row";
import type { ExpenseClaim } from "../../lib/expense-claims";

const base: ExpenseClaim = {
  id: "c1", code: "EXP-0007", date: "2026-11-28", categoryId: "x", categoryName: "Fuel",
  amount: 450, claimedAmount: 450, status: "submitted", remarks: null, rejectReason: null,
  hasReceipt: true, approvedAt: null, createdAt: "2026-11-28",
};

describe("ClaimRow", () => {
  it("shows category, status and amount, and fires onPress", () => {
    const onPress = vi.fn();
    render(<ClaimRow claim={base} onPress={onPress} />);
    expect(screen.getByText("Fuel")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/₹450/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Fuel"));
    expect(onPress).toHaveBeenCalledWith(base);
  });

  it("shows the reduced-amount hint when approved for less", () => {
    render(<ClaimRow claim={{ ...base, status: "approved", amount: 300, claimedAmount: 450 }} onPress={vi.fn()} />);
    expect(screen.getByText("Reimbursed")).toBeInTheDocument();
    expect(screen.getByText(/of ₹450/)).toBeInTheDocument();
  });

  it("shows the rejection reason", () => {
    render(<ClaimRow claim={{ ...base, status: "rejected", rejectReason: "blurry bill" }} onPress={vi.fn()} />);
    expect(screen.getByText(/blurry bill/)).toBeInTheDocument();
  });

  it("hints that a pending claim is editable", () => {
    render(<ClaimRow claim={{ ...base, status: "submitted" }} onPress={vi.fn()} />);
    expect(screen.getByText(/Tap to edit while it/)).toBeInTheDocument();
  });
});
