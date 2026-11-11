import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: (p: { open: boolean; children: React.ReactNode; onOpenChange: () => void }) => (
    <div>
      <button onClick={p.onOpenChange}>proof-close</button>
      {p.open ? p.children : null}
    </div>
  ),
  DialogContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogBody: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogHeader: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogTitle: (p: { children: React.ReactNode }) => <h2>{p.children}</h2>,
}));
vi.mock("@/features/collections/credit-note-dialog", () => ({ CreditNoteDialog: () => <div>credit-note</div> }));
vi.mock("./sales-return-dialog", () => ({ SalesReturnDialog: () => <div>sales-return</div> }));
vi.mock("./ledger-edit-collection-dialog", () => ({
  LedgerEditCollectionDialog: (p: { onOpenChange: (o: boolean) => void }) => (
    <>
      <button onClick={() => p.onOpenChange(false)}>close-collection</button>
      <button onClick={() => p.onOpenChange(true)}>open-collection</button>
    </>
  ),
}));
vi.mock("./ledger-edit-return-dialog", () => ({
  LedgerEditReturnDialog: (p: { onOpenChange: (o: boolean) => void }) => (
    <>
      <button onClick={() => p.onOpenChange(false)}>close-return</button>
      <button onClick={() => p.onOpenChange(true)}>open-return</button>
    </>
  ),
}));
vi.mock("./opening-balance-dialog", () => ({ OpeningBalanceDialog: () => <div>opening-balance</div> }));

import { LedgerDialogs, type LedgerDialogsState } from "./ledger-dialogs";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const allPerms = { canCreateCreditNote: true, canCreateReturn: true, canEditEntries: true, canManageOpening: true };

const state = (over: Partial<LedgerDialogsState> = {}): LedgerDialogsState => ({
  creditNoteOpen: false,
  setCreditNoteOpen: vi.fn(),
  returnOpen: false,
  setReturnOpen: vi.fn(),
  openingOpen: false,
  setOpeningOpen: vi.fn(),
  editCollectionId: null,
  setEditCollectionId: vi.fn(),
  editReturnId: null,
  setEditReturnId: vi.fn(),
  proof: null,
  setProof: vi.fn(),
  ...over,
});

const renderDialogs = (perms = allPerms, s = state()) =>
  render(<LedgerDialogs customerId="c1" customerName="Raj" role="SUPER_ADMIN" actionConfig={cfg} perms={perms} state={s} onRefetch={vi.fn()} />);

describe("LedgerDialogs", () => {
  it("shows the proof image when set and clears it on close", () => {
    const s = state({ proof: { url: "blob:x" } });
    renderDialogs(allPerms, s);
    expect(screen.getByAltText("Payment receipt")).toHaveAttribute("src", "blob:x");
    fireEvent.click(screen.getByText("proof-close"));
    expect(s.setProof).toHaveBeenCalledWith(null);
  });

  it("renders every gated dialog for a super admin and clears edit ids on close", () => {
    const s = state();
    renderDialogs(allPerms, s);
    expect(screen.getByText("credit-note")).toBeInTheDocument();
    expect(screen.getByText("sales-return")).toBeInTheDocument();
    expect(screen.getByText("opening-balance")).toBeInTheDocument();

    fireEvent.click(screen.getByText("close-collection"));
    expect(s.setEditCollectionId).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("close-return"));
    expect(s.setEditReturnId).toHaveBeenCalledWith(null);

    // opening (o=true) must NOT clear the edit ids
    (s.setEditCollectionId as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByText("open-collection"));
    fireEvent.click(screen.getByText("open-return"));
    expect(s.setEditCollectionId).not.toHaveBeenCalled();
  });

  it("omits dialogs the role may not use", () => {
    renderDialogs({ canCreateCreditNote: false, canCreateReturn: false, canEditEntries: false, canManageOpening: false });
    expect(screen.queryByText("credit-note")).not.toBeInTheDocument();
    expect(screen.queryByText("sales-return")).not.toBeInTheDocument();
    expect(screen.queryByText("opening-balance")).not.toBeInTheDocument();
    expect(screen.queryByText("close-collection")).not.toBeInTheDocument();
    expect(screen.queryByText("close-return")).not.toBeInTheDocument();
  });
});
