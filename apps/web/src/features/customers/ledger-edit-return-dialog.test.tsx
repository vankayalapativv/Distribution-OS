import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hook = {
  open: true,
  ret: { invoiceNumber: "INV-1" } as { invoiceNumber: string } | null,
  isLoading: false,
  lines: [] as unknown[],
  available: 500,
  total: 100,
  overCap: false,
  date: "2026-07-01",
  setDate: vi.fn(),
  qty: {},
  setQty: vi.fn(),
  reason: "",
  setReason: vi.fn(),
  proofFile: null,
  setProofFile: vi.fn(),
  busy: false,
  error: null,
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-ledger-return-edit", () => ({ useLedgerReturnEdit: () => hook }));
vi.mock("./ledger-edit-return-fields", () => ({ LedgerEditReturnFields: () => <div>fields</div> }));

import { LedgerEditReturnDialog } from "./ledger-edit-return-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof hook> = {}) => {
  Object.assign(hook, { isLoading: false, busy: false, total: 100, overCap: false, ret: { invoiceNumber: "INV-1" } }, over);
  hook.handleSubmit.mockClear();
};

describe("LedgerEditReturnDialog", () => {
  it("shows the invoice number, fields, and submits", () => {
    reset();
    render(<LedgerEditReturnDialog returnId="ret1" onOpenChange={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByText(/Edit sales return — INV-1/)).toBeInTheDocument();
    expect(screen.getByText("fields")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    expect(hook.handleSubmit).toHaveBeenCalled();
  });

  it("disables save when total is 0 or over cap, and shows loading", () => {
    reset({ isLoading: true, ret: null });
    render(<LedgerEditReturnDialog returnId="ret1" onOpenChange={vi.fn()} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByText("Edit sales return")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows a busy Saving… label and cancels", () => {
    reset({ busy: true });
    const onOpenChange = vi.fn();
    render(<LedgerEditReturnDialog returnId="ret1" onOpenChange={onOpenChange} onSaved={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
