import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/popover", () => ({
  Popover: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  PopoverTrigger: (p: { children: React.ReactNode }) => <button>{p.children}</button>,
  PopoverContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));
vi.mock("./customer-ledger-range", () => ({ LedgerDateRange: () => <div>date-range</div> }));
vi.mock("./customer-new-order-button", () => ({ CustomerNewOrderButton: () => <div>new-order</div> }));
vi.mock("./customer-new-collection-button", () => ({ CustomerNewCollectionButton: () => <div>new-collection</div> }));

import { LedgerToolbar } from "./ledger-toolbar";
import type { LedgerActions } from "./ledger-types";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const range = {
  from: "2026-07-01",
  to: "2026-07-31",
  preset: "this-month" as const,
  open: false,
  onOpenChange: vi.fn(),
  onPreset: vi.fn(),
  onCalendar: vi.fn(),
};
const actions = (over: Partial<LedgerActions> = {}): LedgerActions => ({
  canCreateOrder: true,
  canCreateCollection: true,
  canCreateReturn: true,
  canCreateCreditNote: true,
  canManageOpening: true,
  onReturn: vi.fn(),
  onCreditNote: vi.fn(),
  onOpening: vi.fn(),
  onDownload: vi.fn(),
  downloadDisabled: false,
  downloading: false,
  ...over,
});

const renderBar = (a: LedgerActions) =>
  render(<LedgerToolbar customerId="c1" customerName="Raj" actionConfig={cfg} range={range} actions={a} />);

describe("LedgerToolbar", () => {
  it("shows the new-order/collection buttons and every action item, firing callbacks", () => {
    const a = actions();
    renderBar(a);
    expect(screen.getByText("new-order")).toBeInTheDocument();
    expect(screen.getByText("new-collection")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /New Sales Return/ }));
    expect(a.onReturn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /New Credit Note/ }));
    expect(a.onCreditNote).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Manage Opening Balance/ }));
    expect(a.onOpening).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    expect(a.onDownload).toHaveBeenCalled();
  });

  it("hides gated buttons/items and shows the busy download label", () => {
    renderBar(
      actions({
        canCreateOrder: false,
        canCreateCollection: false,
        canCreateReturn: false,
        canCreateCreditNote: false,
        canManageOpening: false,
        downloading: true,
        downloadDisabled: true,
      }),
    );
    expect(screen.queryByText("new-order")).not.toBeInTheDocument();
    expect(screen.queryByText("new-collection")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Sales Return/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Credit Note/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage Opening/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
  });
});
