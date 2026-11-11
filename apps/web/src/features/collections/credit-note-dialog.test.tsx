import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hook = {
  form: {}, set: vi.fn(), proofFile: null, setProofFile: vi.fn(), busy: false,
  error: null as string | null, handleCreate: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
  reset: vi.fn(), collectors: [], invoices: [], invoicesLoading: false, canSubmit: true,
};
vi.mock("./use-credit-note", () => ({ useCreditNote: () => hook }));
vi.mock("./credit-note-fields", () => ({ CreditNoteFields: () => <div data-testid="cn-fields" /> }));

import { CreditNoteDialog } from "./credit-note-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), customerId: "cu1", customerName: "Sri Laxmi", actionConfig: config };

describe("CreditNoteDialog", () => {
  it("titles the dialog with the customer and renders the fields", () => {
    render(<CreditNoteDialog {...props} />);
    expect(screen.getByText(/New credit note — Sri Laxmi/)).toBeInTheDocument();
    expect(screen.getByTestId("cn-fields")).toBeInTheDocument();
  });

  it("enables submit when the hook says it can", () => {
    render(<CreditNoteDialog {...props} />);
    expect(screen.getByRole("button", { name: "Create credit note" })).toBeEnabled();
  });

  it("disables submit and shows a busy label while creating", () => {
    hook.busy = true;
    render(<CreditNoteDialog {...props} />);
    expect(screen.getByText("Creating…")).toBeDisabled();
    hook.busy = false;
  });

  it("shows an error and cancels", () => {
    hook.error = "Failed to create the credit note.";
    const onOpenChange = vi.fn();
    render(<CreditNoteDialog {...props} onOpenChange={onOpenChange} />);
    expect(screen.getByText(/Failed to create/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    hook.error = null;
  });
});
