import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { customerColumns, customerSkeleton } from "./logistics-customer-columns";
import type { DeliveryCustomerRow } from "./logistics-api";

const row: DeliveryCustomerRow = {
  customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1", area: "Nalgonda",
  deliveryCount: 7, lastDeliveryDate: "2026-09-12", photoCount: 18,
};

function renderCell(col: ColumnDef<DeliveryCustomerRow>, r: DeliveryCustomerRow) {
  const key = "accessorKey" in col ? (col.accessorKey as keyof DeliveryCustomerRow) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = { row: { original: r }, getValue: () => (key ? r[key] : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<div>{(col as any).cell(ctx)}</div>);
}

describe("customerColumns", () => {
  it("has a cell for every column and a matching skeleton", () => {
    expect(customerColumns).toHaveLength(5);
    expect(customerSkeleton).toHaveLength(5);
  });

  it("renders name, code, area, counts", () => {
    const text = customerColumns.map((c) => renderCell(c, row).container.textContent).join(" | ");
    expect(text).toContain("Sri Laxmi");
    expect(text).toContain("CUST-1");
    expect(text).toContain("Nalgonda");
    expect(text).toContain("7");
    expect(text).toContain("18");
  });

  it("falls back to a dash for a missing name and area", () => {
    expect(renderCell(customerColumns[0], { ...row, customerName: null, customerCode: null }).container.textContent).toContain("—");
    expect(renderCell(customerColumns[1], { ...row, area: null }).container.textContent).toContain("—");
  });

  it("renders every skeleton cell", () => {
    const { container } = render(<table><tbody><tr>{customerSkeleton.map((c, i) => <td key={i}>{c()}</td>)}</tr></tbody></table>);
    expect(container.querySelectorAll("td").length).toBe(customerSkeleton.length);
  });
});
