import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hookState = {
  form: {}, setForm: vi.fn(), proofFile: null, setProofFile: vi.fn(),
  isCreating: false, error: null as string | null, setError: vi.fn(),
  restored: false, discardDraft: vi.fn(), handleCreate: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
  canSubmit: true,
};
vi.mock("./use-collection-create", () => ({ useCollectionCreate: () => hookState }));
vi.mock("./collections-form-fields", () => ({ CollectionFormFields: () => <div data-testid="fields" /> }));

import { CollectionsCreateDialog } from "./collections-create-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), customers: [], collectors: [], actionConfig: config };

describe("CollectionsCreateDialog", () => {
  it("renders the form and a submit button", () => {
    render(<CollectionsCreateDialog {...props} />);
    expect(screen.getByTestId("fields")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record collection" })).toBeInTheDocument();
  });

  it("shows the restored-draft banner and discards it", () => {
    hookState.restored = true;
    render(<CollectionsCreateDialog {...props} />);
    expect(screen.getByText(/Restored your unsaved entry/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Discard"));
    expect(hookState.discardDraft).toHaveBeenCalled();
    hookState.restored = false;
  });

  it("shows an error message when present", () => {
    hookState.error = "Attach the payment proof.";
    render(<CollectionsCreateDialog {...props} />);
    expect(screen.getByText(/Attach the payment proof/)).toBeInTheDocument();
    hookState.error = null;
  });

  it("cancels via the Cancel button", () => {
    const onOpenChange = vi.fn();
    render(<CollectionsCreateDialog {...props} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables submit while creating", () => {
    hookState.isCreating = true;
    render(<CollectionsCreateDialog {...props} />);
    expect(screen.getByText("Recording…")).toBeInTheDocument();
    hookState.isCreating = false;
  });

  it("clears the error and closes when dismissed with Escape", () => {
    const onOpenChange = vi.fn();
    render(<CollectionsCreateDialog {...props} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(hookState.setError).toHaveBeenCalledWith(null);
  });
});
