import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./orders-create-dialog", () => ({
  OrdersCreateDialog: (p: any) => (
    <div data-testid={p.order ? "edit-dialog" : "create-dialog"} data-open={String(p.open)} data-order={p.order?.id ?? "new"}>
      <button onClick={() => p.onOpenChange(false)}>close</button>
      <button onClick={() => p.onOpenChange(true)}>reopen</button>
    </div>
  ),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersCreateEditDialogs } from "./orders-create-edit-dialogs";
import type { OrdersDialogs } from "./use-orders-dialogs";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const data = { products: [], customers: [], salesExecutives: [], actionConfig: cfg };

const dialogs = (over: Partial<OrdersDialogs> = {}): OrdersDialogs =>
  ({
    createOpen: true,
    editOpen: true,
    editingOrder: null,
    setCreateOpen: vi.fn(),
    setEditOpen: vi.fn(),
    setEditingOrder: vi.fn(),
    ...over,
  }) as unknown as OrdersDialogs;

afterEach(() => vi.restoreAllMocks());

describe("OrdersCreateEditDialogs", () => {
  it("renders nothing when the user cannot create", () => {
    const { container } = render(<OrdersCreateEditDialogs dialogs={dialogs()} canCreate={false} data={data} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the create dialog when no order is being edited", () => {
    render(<OrdersCreateEditDialogs dialogs={dialogs()} canCreate data={data} />);
    expect(screen.getByTestId("create-dialog")).toHaveAttribute("data-order", "new");
    expect(screen.queryByTestId("edit-dialog")).not.toBeInTheDocument();
  });

  it("renders the edit dialog seeded from the editing order", () => {
    render(<OrdersCreateEditDialogs dialogs={dialogs({ editingOrder: { id: "o7" } as never })} canCreate data={data} />);
    expect(screen.getByTestId("edit-dialog")).toHaveAttribute("data-order", "o7");
  });

  it("closing the edit dialog clears both the open flag and the editing order", () => {
    const d = dialogs({ editingOrder: { id: "o7" } as never });
    render(<OrdersCreateEditDialogs dialogs={d} canCreate data={data} />);
    fireEvent.click(within(screen.getByTestId("edit-dialog")).getByText("close"));
    expect(d.setEditOpen).toHaveBeenCalledWith(false);
    expect(d.setEditingOrder).toHaveBeenCalledWith(null);
  });

  it("re-opening the edit dialog keeps the editing order (only sets the open flag)", () => {
    const d = dialogs({ editingOrder: { id: "o7" } as never });
    render(<OrdersCreateEditDialogs dialogs={d} canCreate data={data} />);
    fireEvent.click(within(screen.getByTestId("edit-dialog")).getByText("reopen"));
    expect(d.setEditOpen).toHaveBeenCalledWith(true);
    expect(d.setEditingOrder).not.toHaveBeenCalled();
  });

  it("closing the create dialog forwards to setCreateOpen", () => {
    const d = dialogs();
    render(<OrdersCreateEditDialogs dialogs={d} canCreate data={data} />);
    fireEvent.click(within(screen.getByTestId("create-dialog")).getByText("close"));
    expect(d.setCreateOpen).toHaveBeenCalledWith(false);
  });
});
