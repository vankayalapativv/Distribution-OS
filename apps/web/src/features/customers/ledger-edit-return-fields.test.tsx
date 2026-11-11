import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/format", () => ({ rupeesExact: (n: number) => `₹${n}` }));
vi.mock("./sales-return-lines", () => ({ SalesReturnLines: () => <div>lines-table</div> }));

import { LedgerEditReturnFields } from "./ledger-edit-return-fields";
import type { ReturnLine } from "./sales-return-edit-logic";

const line = { orderItemId: "a" } as unknown as ReturnLine;
const base = {
  date: "2026-07-01",
  setDate: vi.fn(),
  lines: [line],
  qty: {},
  setQty: vi.fn(),
  available: 500,
  total: 100,
  overCap: false,
  reason: "",
  setReason: vi.fn(),
  proofFile: null as File | null,
  setProofFile: vi.fn(),
  error: null as string | null,
};

describe("LedgerEditReturnFields", () => {
  it("edits date/reason/proof and shows totals", () => {
    const setDate = vi.fn();
    const setReason = vi.fn();
    const setProofFile = vi.fn();
    render(<LedgerEditReturnFields {...base} setDate={setDate} setReason={setReason} setProofFile={setProofFile} />);

    expect(screen.getByText("lines-table")).toBeInTheDocument();
    expect(screen.getByText(/Return total:/)).toHaveTextContent("₹100");

    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "2026-08-01" } });
    expect(setDate).toHaveBeenCalledWith("2026-08-01");
    fireEvent.change(screen.getByPlaceholderText(/damaged/), { target: { value: "wrong" } });
    expect(setReason).toHaveBeenCalledWith("wrong");

    const file = new File(["x"], "proof.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(setProofFile).toHaveBeenCalledWith(file);

    fireEvent.change(input, { target: { files: [] } }); // no file → null
    expect(setProofFile).toHaveBeenCalledWith(null);
  });

  it("shows the over-cap warning and an error, and the proof file name", () => {
    render(<LedgerEditReturnFields {...base} overCap error="Boom" proofFile={new File(["x"], "bill.pdf")} />);
    expect(screen.getByText(/can’t exceed what’s available/)).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByText("bill.pdf")).toBeInTheDocument();
  });

  it("hides totals when there are no lines", () => {
    render(<LedgerEditReturnFields {...base} lines={[]} />);
    expect(screen.queryByText(/Return total:/)).not.toBeInTheDocument();
  });
});
