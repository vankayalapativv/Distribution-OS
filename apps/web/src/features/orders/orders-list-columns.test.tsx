import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";


import { buildOrdersColumns, type OrdersColumnsOptions } from "./orders-list-columns";
import type { Order } from "./orders-api";

const order = (over: Partial<Order>): Order =>
  ({
    id: "o1",
    orderStatus: "active",
    fulfillmentStatus: "ordered",
    fullyInvoiced: false,
    invoices: [],
    returnedUnits: 0,
    ...over,
  }) as Order;

const opts = (over: Partial<OrdersColumnsOptions> = {}): OrdersColumnsOptions => ({
  filterFulfillment: "",
  setFilterFulfillment: vi.fn(),
  canCreate: true,
  canInvoice: true,
  showActions: true,
  onGenerate: vi.fn(),
  onEdit: vi.fn(),
  onCancel: vi.fn(),
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCell = (col: ColumnDef<Order>, o: Order) => render(<>{(col.cell as any)({ row: { original: o } })}</>);
const byId = (cols: ColumnDef<Order>[], id: string) => cols.find((c) => c.id === id)!;

afterEach(() => vi.restoreAllMocks());

describe("buildOrdersColumns", () => {
  it("appends the Actions column only when showActions is set", () => {
    expect(buildOrdersColumns(opts({ showActions: true })).columns.some((c) => c.id === "actions")).toBe(true);
    expect(buildOrdersColumns(opts({ showActions: false })).columns.some((c) => c.id === "actions")).toBe(false);
  });

  it("skeleton has one cell per column", () => {
    const { columns, skeleton } = buildOrdersColumns(opts());
    expect(skeleton).toHaveLength(columns.length);
    const noActions = buildOrdersColumns(opts({ showActions: false }));
    expect(noActions.skeleton).toHaveLength(noActions.columns.length);
  });

  it("renders the Fulfillment header with the filter control", () => {
    const { columns } = buildOrdersColumns(opts());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<>{(byId(columns, "fulfillment").header as any)({})}</>);
    expect(screen.getByText("Fulfillment")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter fulfillment")).toBeInTheDocument();
  });

  it("fulfillment cell shows the badge and a returned-units note when > 0", () => {
    const { columns } = buildOrdersColumns(opts());
    const col = byId(columns, "fulfillment");
    const { rerender } = renderCell(col, order({ returnedUnits: 3 }));
    expect(screen.getByText("3 returned")).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rerender(<>{(col.cell as any)({ row: { original: order({ returnedUnits: 0 }) } })}</>);
    expect(screen.queryByText(/returned/)).not.toBeInTheDocument();
  });

  it("actions cell renders nothing for a delivered order", () => {
    const { columns } = buildOrdersColumns(opts());
    const { container } = renderCell(byId(columns, "actions"), order({ fulfillmentStatus: "delivered" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("actions cell wires every handler to the row's order", () => {
    const h = { onEdit: vi.fn(), onCancel: vi.fn(), onGenerate: vi.fn() };
    const { columns } = buildOrdersColumns(opts(h));
    const o = order({ id: "o9", fulfillmentStatus: "ordered" });
    const col = byId(columns, "actions");
    for (const [label, fn] of [
      [/Create Invoice/, h.onGenerate],
      [/Edit order/, h.onEdit],
      [/Cancel order/, h.onCancel],
    ] as const) {
      renderCell(col, o);
      fireEvent.click(screen.getAllByTitle("Actions")[0]);
      fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
      expect(fn).toHaveBeenCalledWith(o);
    }
  });

  it("handles null returnedUnits and the fully-billed cancel guard", () => {
    const { columns } = buildOrdersColumns(opts());
    // returnedUnits null → no note, no crash.
    renderCell(byId(columns, "fulfillment"), order({ returnedUnits: null as unknown as number }));
    expect(screen.queryByText(/returned/)).not.toBeInTheDocument();
    // fully invoiced + has invoices → Cancel disabled (fullyBilled true branch).
    renderCell(byId(columns, "actions"), order({ fullyInvoiced: true, invoices: [{ id: "i", invoiceNumber: "X" } as never] }));
    fireEvent.click(screen.getAllByTitle("Actions")[0]);
    expect(screen.getAllByRole("button", { name: /Cancel order/ })[0]).toBeDisabled();
    // fully invoiced but invoices missing → fullyBilled false (?? 0 branch), Cancel enabled.
    renderCell(byId(columns, "actions"), order({ fullyInvoiced: true, invoices: null as unknown as [] }));
    fireEvent.click(screen.getAllByTitle("Actions").at(-1)!);
    expect(screen.getAllByRole("button", { name: /Cancel order/ }).at(-1)!).not.toBeDisabled();
  });

  it("renders every skeleton cell (incl. the fulfillment + actions placeholders)", () => {
    const { skeleton } = buildOrdersColumns(opts());
    const { container } = render(
      <div>
        {skeleton.map((cell, i) => (
          <div key={i}>{cell()}</div>
        ))}
      </div>,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
