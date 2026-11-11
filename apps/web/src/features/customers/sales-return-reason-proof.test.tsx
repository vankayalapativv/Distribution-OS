import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalesReturnReasonProof } from "./sales-return-reason-proof";

const base = {
  reason: "",
  setReason: vi.fn(),
  proofFile: null as File | null,
  setProofFile: vi.fn(),
  proofLabel: "Proof (optional)",
  proofPlaceholder: "Attach a document (optional)",
};

describe("SalesReturnReasonProof", () => {
  it("edits the reason and picks / clears a proof file", () => {
    const setReason = vi.fn();
    const setProofFile = vi.fn();
    render(<SalesReturnReasonProof {...base} setReason={setReason} setProofFile={setProofFile} />);

    expect(screen.getByText("Proof (optional)")).toBeInTheDocument();
    expect(screen.getByText("Attach a document (optional)")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/damaged/), { target: { value: "wrong" } });
    expect(setReason).toHaveBeenCalledWith("wrong");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "p.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(setProofFile).toHaveBeenCalledWith(file);
    fireEvent.change(input, { target: { files: [] } });
    expect(setProofFile).toHaveBeenCalledWith(null);
  });

  it("shows the chosen file name", () => {
    render(<SalesReturnReasonProof {...base} proofFile={new File(["x"], "bill.pdf")} />);
    expect(screen.getByText("bill.pdf")).toBeInTheDocument();
  });
});
