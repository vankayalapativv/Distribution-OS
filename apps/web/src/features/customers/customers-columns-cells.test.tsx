import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { customerColumns } from "./customers-columns";
import type { Customer } from "./customers-api";

type CellFn = (ctx: { row: { original: Customer } }) => ReactNode;

function renderNameCell(customer: Partial<Customer>) {
  const col = customerColumns.find((c) => "accessorKey" in c && c.accessorKey === "legalName");
  const cell = (col as unknown as { cell: CellFn }).cell;
  return render(<>{cell({ row: { original: customer as Customer } })}</>);
}
function cellOf(key: string): CellFn {
  const col = customerColumns.find((c) => ("accessorKey" in c ? c.accessorKey : c.id) === key);
  return (col as unknown as { cell: CellFn }).cell;
}
const renderCell = (key: string, customer: Partial<Customer>, value?: unknown) =>
  render(<>{cellOf(key)({ row: { original: customer as Customer }, getValue: () => value } as never)}</>);

describe("customers cells", () => {
  test("Code renders the customer code monospaced", () => {
    renderCell("customerCode", {}, "CUST-0286");
    expect(screen.getByText("CUST-0286")).toBeTruthy();
  });

  test("Oldest unpaid: dash when none, singular/plural, amber past 45 days", () => {
    renderCell("oldestUnpaidDays", { oldestUnpaidDays: null });
    expect(screen.getByText("—")).toBeTruthy();
    renderCell("oldestUnpaidDays", { oldestUnpaidDays: 1 });
    expect(screen.getByText("1 day")).toBeTruthy();
    renderCell("oldestUnpaidDays", { oldestUnpaidDays: 60 });
    expect(screen.getByText("60 days").className).toContain("text-amber-700");
    renderCell("oldestUnpaidDays", { oldestUnpaidDays: 10 });
    expect(screen.getByText("10 days").className).toContain("text-muted-foreground");
  });

  test("Collection Dues: red owed, green credit, ₹0 vs dash by business", () => {
    renderCell("collectionDues", { collectionDues: 5000 });
    expect(screen.getByText("₹5,000").className).toContain("text-red-600");
    renderCell("collectionDues", { collectionDues: -300 });
    expect(screen.getByText(/Cr$/).className).toContain("text-green-700");
    renderCell("collectionDues", { collectionDues: 0, hasBusiness: false });
    expect(screen.getByText("—")).toBeTruthy();
    renderCell("collectionDues", { collectionDues: 0, hasBusiness: true });
    expect(screen.getByText("₹0")).toBeTruthy();
  });

  test("Status renders a StatusBadge", () => {
    renderCell("status", {}, "active");
    expect(screen.getByText("active")).toBeTruthy();
  });
});

describe("customers accessors + empty states", () => {
  test("accessorFns coerce sort values (null oldest → -1)", () => {
    const oldCol = customerColumns.find((c) => "id" in c && c.id === "oldestUnpaidDays") as unknown as { accessorFn: (r: Customer) => unknown };
    const duesCol = customerColumns.find((c) => "id" in c && c.id === "collectionDues") as unknown as { accessorFn: (r: Customer) => unknown };
    expect(oldCol.accessorFn({ oldestUnpaidDays: null } as Customer)).toBe(-1);
    expect(oldCol.accessorFn({ oldestUnpaidDays: 12 } as Customer)).toBe(12);
    expect(duesCol.accessorFn({ collectionDues: 800 } as Customer)).toBe(800);
  });

  test("Name cell omits the meta and phone lines when both are empty", () => {
    renderNameCell({ legalName: "Bare Shop", addressCity: null, salesExecutiveName: null, customerType: null as unknown as string, segment: null, phone: null });
    expect(screen.getByText("Bare Shop")).toBeTruthy();
    expect(screen.queryByText("·")).toBeNull();
  });
});
