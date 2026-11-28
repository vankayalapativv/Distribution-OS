import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Expenditure } from "./expenditures-api";

const f = {
  form: { remarks: "" } as Record<string, string>, set: vi.fn(), bill: null as File | null, setBill: vi.fn(),
  busy: false, error: null as string | null, canSubmit: true,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-expenditure-form", () => ({ useExpenditureForm: () => f }));
vi.mock("./expenditure-form-spend", () => ({ ExpenditureFormSpend: () => <div>SPEND</div> }));
vi.mock("./expenditure-form-details", () => ({ ExpenditureFormDetails: () => <div>DETAILS</div> }));
vi.mock("./expenditure-form-proof", () => ({ ExpenditureFormProof: () => <div>PROOF</div> }));

import { ExpenditureFormDialog } from "./expenditure-form-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), categories: [], people: [], actionConfig: config };

describe("ExpenditureFormDialog", () => {
  it("titles Record for a new entry, renders both sections, and submits", () => {
    render(<ExpenditureFormDialog {...props} editing={null} />);
    expect(screen.getByRole("heading", { name: "Record expenditure" })).toBeInTheDocument();
    expect(screen.getByText("SPEND")).toBeInTheDocument();
    expect(screen.getByText("DETAILS")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Bill/), { target: { files: [new File(["x"], "b.png")] } });
    expect(f.setBill).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Remarks"), { target: { value: "note" } });
    expect(f.set).toHaveBeenCalledWith("remarks", "note");
    fireEvent.click(screen.getByRole("button", { name: "Record expenditure" }));
    expect(f.handleSubmit).toHaveBeenCalled();
  });

  it("titles Edit and notes an existing bill; Cancel closes; Save disabled while busy", () => {
    const onOpenChange = vi.fn();
    const editing = { id: "e1", hasBill: true } as Expenditure;
    const { rerender } = render(<ExpenditureFormDialog {...props} onOpenChange={onOpenChange} editing={editing} />);
    expect(screen.getByRole("heading", { name: "Edit expenditure" })).toBeInTheDocument();
    expect(screen.getByText("PROOF")).toBeInTheDocument(); // inline receipt preview
    expect(screen.getByText(/Choose a file below to replace it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    f.busy = true;
    rerender(<ExpenditureFormDialog {...props} editing={editing} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    f.busy = false;
  });

  it("clears the bill to null when the file input is emptied", () => {
    render(<ExpenditureFormDialog {...props} editing={null} />);
    fireEvent.change(screen.getByLabelText(/Bill/), { target: { files: [] } }); // no file → null
    expect(f.setBill).toHaveBeenCalledWith(null);
  });

  it("shows no proof preview for an editing entry that has no bill", () => {
    render(<ExpenditureFormDialog {...props} editing={{ id: "e2", hasBill: false } as Expenditure} />);
    expect(screen.queryByText("PROOF")).not.toBeInTheDocument();
  });

  it("drops the proof preview once a replacement bill is chosen", () => {
    f.bill = new File(["x"], "b.png");
    render(<ExpenditureFormDialog {...props} editing={{ id: "e1", hasBill: true } as Expenditure} />);
    expect(screen.queryByText("PROOF")).not.toBeInTheDocument();
    f.bill = null;
  });

  it("shows a save error", () => {
    f.error = "Failed to save";
    render(<ExpenditureFormDialog {...props} editing={null} />);
    expect(screen.getByText("Failed to save")).toBeInTheDocument();
    f.error = null;
  });
});
