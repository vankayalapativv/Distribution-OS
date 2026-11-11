import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { customerColumns, customerSkeleton } from "./customers-columns";
import type { Customer } from "./customers-api";

type CellFn = (ctx: { row: { original: Customer } }) => ReactNode;

function renderNameCell(customer: Partial<Customer>) {
  const col = customerColumns.find(
    (c) => "accessorKey" in c && c.accessorKey === "legalName",
  );
  const cell = (col as unknown as { cell: CellFn }).cell;
  return render(<>{cell({ row: { original: customer as Customer } })}</>);
}

const base: Partial<Customer> = {
  legalName: "9th Gear Car Service",
  addressCity: "Nalgonda",
  phone: "+919603049233",
  salesExecutiveName: "Sandeep",
  customerType: "mechanic",
  segment: "Car",
};

describe("customers Name cell", () => {
  test("shows name, then city · executive · type, then phone", () => {
    renderNameCell(base);
    expect(screen.getByText("9th Gear Car Service")).toBeTruthy();
    expect(screen.getByText("Nalgonda · Sandeep · Mechanic")).toBeTruthy();
    expect(screen.getByText("+919603049233")).toBeTruthy();
  });

  test("renders one tooltip-labelled icon per segment (multi-segment)", () => {
    const { container } = renderNameCell({ ...base, segment: "2W,Car" });
    expect(screen.getByLabelText("2W")).toBeTruthy();
    expect(screen.getByLabelText("Car")).toBeTruthy();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  test("each segment icon carries its colour class", () => {
    renderNameCell({ ...base, segment: "2W,3W,Car,Commercial,Agri" });
    expect(screen.getByLabelText("2W").className).toContain("text-sky-400");
    expect(screen.getByLabelText("3W").className).toContain("text-amber-500");
    expect(screen.getByLabelText("Car").className).toContain("text-orange-500");
    expect(screen.getByLabelText("Commercial").className).toContain("text-red-500");
    expect(screen.getByLabelText("Agri").className).toContain("text-green-600");
  });

  test("drops a missing executive from the meta line", () => {
    renderNameCell({ ...base, salesExecutiveName: null });
    expect(screen.getByText("Nalgonda · Mechanic")).toBeTruthy();
  });

  test("Sales Executive / Type / Segment are no longer standalone columns", () => {
    const ids = customerColumns.map((c) =>
      "accessorKey" in c ? c.accessorKey : c.id,
    );
    expect(ids).not.toContain("salesExecutive");
    expect(ids).not.toContain("customerType");
    expect(ids).not.toContain("segment");
  });

  test("meta line passes an unknown customer type through unchanged", () => {
    renderNameCell({ ...base, customerType: "wholesaler" });
    expect(screen.getByText("Nalgonda · Sandeep · wholesaler")).toBeTruthy();
  });
});

// Find a column's cell renderer by accessorKey or id.
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

describe("customerSkeleton", () => {
  test("has one skeleton cell per column and each renders", () => {
    expect(customerSkeleton).toHaveLength(customerColumns.length);
    const { container } = render(<>{customerSkeleton.map((c, i) => <span key={i}>{c()}</span>)}</>);
    // Each cell renders at least one shimmer element; the Name cell renders several.
    expect(container.querySelectorAll("*").length).toBeGreaterThan(customerColumns.length);
  });
});
