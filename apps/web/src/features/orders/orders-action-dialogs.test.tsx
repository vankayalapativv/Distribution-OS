import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: any) =>
    p.open ? (
      <div data-testid="confirm">
        <p>{p.description}</p>
        {p.details}
        {p.extra}
        <button onClick={p.onConfirm}>{p.confirmLabel}</button>
        <button onClick={() => p.onOpenChange(false)}>close-confirm</button>
        <button onClick={() => p.onOpenChange(true)}>reopen-confirm</button>
      </div>
    ) : null,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersActionDialogs } from "./orders-action-dialogs";
import type { OrdersDialogs } from "./use-orders-dialogs";
import type { Order } from "./orders-api";

const ord = (over: Partial<Order> = {}): Order =>
  ({ id: "o1", orderCode: "ORD-1", customerName: "Raj", invoices: [], ...over }) as Order;

const dialogs = (over: Partial<OrdersDialogs> = {}): OrdersDialogs =>
  ({
    canceling: null,
    generatedMsg: null,
    cancelNote: "",
    setCanceling: vi.fn(),
    setCancelNote: vi.fn(),
    setGeneratedMsg: vi.fn(),
    invalidate: vi.fn(),
    doCancel: vi.fn(),
    ...over,
  }) as unknown as OrdersDialogs;

const render1 = (d: OrdersDialogs, canCreate = true) =>
  render(<OrdersActionDialogs dialogs={d} canCreate={canCreate} />);

afterEach(() => vi.restoreAllMocks());

describe("OrdersActionDialogs", () => {
  it("shows the plain cancel copy for an un-invoiced order and confirms it", () => {
    const d = dialogs({ canceling: ord() });
    render1(d);
    expect(screen.getByText(/marked Cancelled/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Customer changed their mind/), {
      target: { value: "duplicate" },
    });
    expect(d.setCancelNote).toHaveBeenCalledWith("duplicate");
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(d.doCancel).toHaveBeenCalledWith(d.canceling);
  });

  it("shows the short-close copy when the order has invoices", () => {
    render1(dialogs({ canceling: ord({ invoices: [{ id: "i" } as never] }) }));
    expect(screen.getByText(/short-closed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel remainder" })).toBeInTheDocument();
  });

  it("falls back to — when the order has no customer name", () => {
    render1(dialogs({ canceling: ord({ orderCode: "ORD-2", customerName: null }) }));
    expect(screen.getByText(/ORD-2/)).toBeInTheDocument();
    expect(screen.getByText(/·\s*—/)).toBeInTheDocument();
  });

  it("closing the confirm clears the canceling order and its note", () => {
    const d = dialogs({ canceling: ord() });
    render1(d);
    fireEvent.click(screen.getByRole("button", { name: "close-confirm" }));
    expect(d.setCanceling).toHaveBeenCalledWith(null);
    expect(d.setCancelNote).toHaveBeenCalledWith("");
  });

  it("treats a null invoices list as un-invoiced (plain cancel copy)", () => {
    render1(dialogs({ canceling: ord({ invoices: null as unknown as [] }) }));
    expect(screen.getByText(/marked Cancelled/)).toBeInTheDocument();
  });

  it("an open (o=true) onOpenChange is a no-op — the canceling order is kept", () => {
    const d = dialogs({ canceling: ord() });
    render1(d);
    fireEvent.click(screen.getByRole("button", { name: "reopen-confirm" }));
    expect(d.setCanceling).not.toHaveBeenCalled();
  });

  it("hides the confirm entirely when the user cannot manage orders", () => {
    render1(dialogs({ canceling: ord() }), false);
    expect(screen.queryByTestId("confirm")).not.toBeInTheDocument();
  });

  it("renders the generated toast and dismisses it", () => {
    const d = dialogs({ generatedMsg: "Invoice INV-9 generated." });
    render1(d);
    expect(screen.getByText("Invoice INV-9 generated.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(d.setGeneratedMsg).toHaveBeenCalledWith(null);
  });
});
