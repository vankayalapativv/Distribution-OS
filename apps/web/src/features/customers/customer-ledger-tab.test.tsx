import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const view = {
  from: "2026-07-01",
  to: "2026-07-31",
  preset: "this-month",
  calOpen: false,
  setCalOpen: vi.fn(),
  onPreset: vi.fn(),
  onCalendar: vi.fn(),
  query: { isLoading: false, refetch: vi.fn() },
  data: { rows: [] },
  showSkeleton: false,
  empty: true,
  proof: null,
  setProof: vi.fn(),
  downloading: false,
  openInvoice: vi.fn(),
  openProof: vi.fn(),
  openReturnProof: vi.fn(),
  downloadPdf: vi.fn(),
};
const dialogState = {
  setReturnOpen: vi.fn(),
  setCreditNoteOpen: vi.fn(),
  setOpeningOpen: vi.fn(),
  onEdit: vi.fn(),
};
vi.mock("./use-ledger-view", () => ({ useLedgerView: () => view }));
vi.mock("./use-ledger-dialog-state", () => ({ useLedgerDialogState: () => dialogState }));
vi.mock("./ledger-toolbar", () => ({
  LedgerToolbar: (p: { actions: Record<string, () => void> }) => (
    <div>
      <button onClick={p.actions.onDownload}>t-download</button>
      <button onClick={p.actions.onReturn}>t-return</button>
      <button onClick={p.actions.onCreditNote}>t-credit</button>
      <button onClick={p.actions.onOpening}>t-opening</button>
    </div>
  ),
}));
vi.mock("./ledger-table", () => ({
  LedgerTable: (p: {
    handlers: {
      onEdit: (r: unknown) => void;
      onOpenInvoice: (id: string) => void;
      onOpenProof: (id: string) => void;
      onOpenReturnProof: (id: string) => void;
    };
  }) => (
    <div>
      <button onClick={() => p.handlers.onOpenInvoice("inv1")}>t-invoice</button>
      <button onClick={() => p.handlers.onOpenProof("col1")}>t-proof</button>
      <button onClick={() => p.handlers.onOpenReturnProof("r1")}>t-returnproof</button>
      <button onClick={() => p.handlers.onEdit({ type: "Sale", invoiceId: "i1" })}>t-edit</button>
    </div>
  ),
}));
vi.mock("./ledger-dialogs", () => ({
  LedgerDialogs: (p: { onRefetch: () => void }) => <button onClick={p.onRefetch}>dialogs</button>,
}));

import { CustomerLedgerTab } from "./customer-ledger-tab";

const cfg = { apiBaseUrl: "x", authToken: "t" };

describe("CustomerLedgerTab", () => {
  it("wires the toolbar actions and table handlers to the view + dialog state", () => {
    render(<CustomerLedgerTab customerId="c1" customerName="Raj" role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("dialogs")).toBeInTheDocument();

    fireEvent.click(screen.getByText("t-download"));
    expect(view.downloadPdf).toHaveBeenCalled();
    fireEvent.click(screen.getByText("t-return"));
    expect(dialogState.setReturnOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("t-credit"));
    expect(dialogState.setCreditNoteOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("t-opening"));
    expect(dialogState.setOpeningOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("t-invoice"));
    expect(view.openInvoice).toHaveBeenCalledWith("inv1");
    fireEvent.click(screen.getByText("t-proof"));
    expect(view.openProof).toHaveBeenCalledWith("col1");
    fireEvent.click(screen.getByText("t-returnproof"));
    expect(view.openReturnProof).toHaveBeenCalledWith("r1");
    fireEvent.click(screen.getByText("t-edit"));
    expect(dialogState.onEdit).toHaveBeenCalledWith({ type: "Sale", invoiceId: "i1" });

    fireEvent.click(screen.getByText("dialogs")); // onRefetch → query.refetch
    expect(view.query.refetch).toHaveBeenCalled();
  });
});
