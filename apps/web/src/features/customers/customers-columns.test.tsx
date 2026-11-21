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

describe("customerSkeleton", () => {
  test("has one skeleton cell per column and each renders", () => {
    expect(customerSkeleton).toHaveLength(customerColumns.length);
    const { container } = render(<>{customerSkeleton.map((c, i) => <span key={i}>{c()}</span>)}</>);
    // Each cell renders at least one shimmer element; the Name cell renders several.
    expect(container.querySelectorAll("*").length).toBeGreaterThan(customerColumns.length);
  });
});
