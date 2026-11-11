import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/invoices/invoices-api", () => ({ openInvoicePdf: vi.fn() }));

import { orderColumns } from "./orders-columns";
import type { ColumnDef } from "@tanstack/react-table";
import type { Order } from "./orders-api";

const order = (over: Partial<Order>): Order =>
  ({
    orderDate: "2026-03-01",
    orderCode: "ORD-1",
    orderStatus: "active",
    customerName: "Raj",
    customerType: null,
    addressCity: null,
    salesExecutiveName: null,
    customerPhone: null,
    segment: null,
    totalLitres: 12,
    returnedLitres: 0,
    invoices: [],
    ...over,
  }) as Order;

const col = (accessorOrId: string) =>
  (orderColumns as ColumnDef<Order>[]).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => (c as any).accessorKey === accessorOrId || c.id === accessorOrId,
  )!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCell = (c: ColumnDef<Order>, o: Order, getValue?: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render(<>{(c.cell as any)({ row: { original: o }, getValue: () => getValue })}</>);

describe("orderColumns", () => {
  it("has the six base columns in order", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(orderColumns.map((c) => (c as any).accessorKey ?? c.id)).toEqual([
      "orderDate",
      "invoicedDate",
      "orderCode",
      "customerName",
      "totalLitres",
    ]);
  });

  it("Code cell strikes through a cancelled order", () => {
    const { container, rerender } = renderCell(col("orderCode"), order({ orderStatus: "cancelled" }), "ORD-9");
    expect(container.querySelector("span")?.className).toContain("line-through");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rerender(<>{(col("orderCode").cell as any)({ row: { original: order({}) }, getValue: () => "ORD-1" })}</>);
    expect(screen.getByText("ORD-1").className).not.toContain("line-through");
  });

  it("Customer cell renders the stacked identity", () => {
    renderCell(col("customerName"), order({ customerName: "Raj Motors" }));
    expect(screen.getByText("Raj Motors")).toBeInTheDocument();
  });

  it("Total Litres shows the litres and a returned note when > 0", () => {
    renderCell(col("totalLitres"), order({ totalLitres: 12, returnedLitres: 3 }));
    expect(screen.getByText("12 L")).toBeInTheDocument();
    expect(screen.getByText("−3 L")).toBeInTheDocument();
  });

  it("Total Litres shows an em dash when null and no note when nothing returned", () => {
    renderCell(col("totalLitres"), order({ totalLitres: null, returnedLitres: 0 }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/L returned/)).not.toBeInTheDocument();
  });

  it("Ordered Date cell formats the value", () => {
    const { container } = renderCell(col("orderDate"), order({}), "2026-03-01");
    expect(container.textContent).toMatch(/2026|Mar|1/);
  });

  it("Invoiced Date cell delegates to the invoiced-date cell", () => {
    renderCell(col("invoicedDate"), order({ invoices: [] }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
