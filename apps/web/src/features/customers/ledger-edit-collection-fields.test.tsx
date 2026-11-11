import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerEditCollectionFields } from "./ledger-edit-collection-fields";

const base = {
  verified: false,
  amount: "1500",
  setAmount: vi.fn(),
  date: "2026-07-01",
  setDate: vi.fn(),
  mode: "upi",
  setMode: vi.fn(),
  reference: "UTR9",
  setReference: vi.fn(),
  remark: "",
  setRemark: vi.fn(),
  error: null as string | null,
};

describe("LedgerEditCollectionFields", () => {
  it("sanitizes the amount, edits date/reference/remark", () => {
    const setAmount = vi.fn();
    const setDate = vi.fn();
    const setReference = vi.fn();
    const setRemark = vi.fn();
    render(<LedgerEditCollectionFields {...base} setAmount={setAmount} setDate={setDate} setReference={setReference} setRemark={setRemark} />);

    fireEvent.change(screen.getByDisplayValue("1500"), { target: { value: "20a0.5" } });
    expect(setAmount).toHaveBeenCalledWith("200.5");
    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "2026-08-01" } });
    expect(setDate).toHaveBeenCalledWith("2026-08-01");
    fireEvent.change(screen.getByDisplayValue("UTR9"), { target: { value: "UTR10" } });
    expect(setReference).toHaveBeenCalledWith("UTR10");
    fireEvent.change(screen.getByPlaceholderText("Optional notes"), { target: { value: "n" } });
    expect(setRemark).toHaveBeenCalledWith("n");
  });

  it("shows the verified warning and an error when present", () => {
    render(<LedgerEditCollectionFields {...base} verified error="Boom" />);
    expect(screen.getByText(/This entry is verified/)).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("hides the verified warning by default", () => {
    render(<LedgerEditCollectionFields {...base} />);
    expect(screen.queryByText(/This entry is verified/)).not.toBeInTheDocument();
  });
});
