import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ onSelect, renderOption }: any) => (
    <div>
      <button onClick={() => onSelect("picked")}>select</button>
      {renderOption?.({ id: "u1", name: "Ravi", roleLabel: "SE" })}
    </div>
  ),
}));

import { CreditNoteFields } from "./credit-note-fields";
import { emptyCreditNoteForm } from "./credit-note-payload";

const common = {
  form: emptyCreditNoteForm(), set: vi.fn(), proofFile: null, setProofFile: vi.fn(),
  collectors: [], invoices: [], invoicesLoading: false,
};

describe("CreditNoteFields", () => {
  it("renders the issuer, amount, invoice and reference fields", () => {
    render(<CreditNoteFields {...common} />);
    expect(screen.getByText("Issued By")).toBeInTheDocument();
    expect(screen.getByText("Against Invoice")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Credit note no.")).toBeInTheDocument();
  });

  it("updates the amount via set()", () => {
    const set = vi.fn();
    render(<CreditNoteFields {...common} set={set} />);
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "750" } });
    expect(set).toHaveBeenCalledWith({ amount: "750" });
  });

  it("shows the picked file name", () => {
    render(<CreditNoteFields {...common} proofFile={new File(["x"], "note.pdf", { type: "application/pdf" })} />);
    expect(screen.getByText("note.pdf")).toBeInTheDocument();
  });
});
