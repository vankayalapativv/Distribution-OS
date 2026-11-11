import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hook = {
  open: true,
  data: { collectionCode: "COL-1" } as { collectionCode: string } | null,
  isLoading: false,
  verified: false,
  busy: false,
  error: null as string | null,
  amount: "1500",
  setAmount: vi.fn(),
  date: "2026-07-01",
  setDate: vi.fn(),
  mode: "upi",
  setMode: vi.fn(),
  reference: "",
  setReference: vi.fn(),
  remark: "",
  setRemark: vi.fn(),
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-ledger-collection-edit", () => ({ useLedgerCollectionEdit: () => hook }));
vi.mock("./ledger-edit-collection-fields", () => ({ LedgerEditCollectionFields: () => <div>fields</div> }));

import { LedgerEditCollectionDialog } from "./ledger-edit-collection-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof hook> = {}) => {
  Object.assign(hook, { isLoading: false, busy: false, data: { collectionCode: "COL-1" } }, over);
  hook.handleSubmit.mockClear();
};

describe("LedgerEditCollectionDialog", () => {
  it("renders the code in the title, the fields, and submits", () => {
    reset();
    render(<LedgerEditCollectionDialog collectionId="col1" onOpenChange={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByText(/Edit entry — COL-1/)).toBeInTheDocument();
    expect(screen.getByText("fields")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    expect(hook.handleSubmit).toHaveBeenCalled();
  });

  it("shows a loading state (no fields) and no code when data is absent", () => {
    reset({ isLoading: true, data: null });
    render(<LedgerEditCollectionDialog collectionId="col1" onOpenChange={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("fields")).not.toBeInTheDocument();
    expect(screen.getByText("Edit entry")).toBeInTheDocument();
  });

  it("shows a busy Saving… label and cancels", () => {
    reset({ busy: true });
    const onOpenChange = vi.fn();
    render(<LedgerEditCollectionDialog collectionId="col1" onOpenChange={onOpenChange} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
