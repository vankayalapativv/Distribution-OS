import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { deliveryColumns, deliverySkeleton } from "./logistics-delivery-columns";
import type { DeliveryStopRow } from "./logistics-api";

const row: DeliveryStopRow = {
  stopId: "s1", runId: "r1", date: "2026-09-14", createdAt: "2026-09-14T03:34:00Z",
  customerId: "c1", customerName: "Sri Laxmi", customerCode: "CUST-1",
  driverName: "Ramesh", vehicleNumber: "TS07 UB 4521", latitude: 17.0575, longitude: 79.2684, photoCount: 3,
};

function renderCell(col: ColumnDef<DeliveryStopRow>, r: DeliveryStopRow) {
  const key = "accessorKey" in col ? (col.accessorKey as keyof DeliveryStopRow) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = { row: { original: r }, getValue: () => (key ? r[key] : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<div>{(col as any).cell(ctx)}</div>);
}

describe("deliveryColumns", () => {
  it("has a cell for every column and a matching skeleton", () => {
    expect(deliveryColumns).toHaveLength(5);
    expect(deliverySkeleton).toHaveLength(5);
  });

  it("renders customer, driver/vehicle, coordinates and photos", () => {
    const text = deliveryColumns.map((c) => renderCell(c, row).container.textContent).join(" | ");
    expect(text).toContain("Sri Laxmi");
    expect(text).toContain("Ramesh");
    expect(text).toContain("TS07 UB 4521");
    expect(text).toContain("17.0575, 79.2684");
    expect(text).toContain("3");
  });

  it("dashes out missing customer, driver and coordinates", () => {
    expect(renderCell(deliveryColumns[1], { ...row, customerName: null, customerCode: null }).container.textContent).toContain("—");
    expect(renderCell(deliveryColumns[2], { ...row, driverName: null, vehicleNumber: null }).container.textContent).toContain("—");
    expect(renderCell(deliveryColumns[3], { ...row, latitude: null, longitude: null }).container.textContent).toContain("—");
  });

  it("renders every skeleton cell", () => {
    const { container } = render(<table><tbody><tr>{deliverySkeleton.map((c, i) => <td key={i}>{c()}</td>)}</tr></tbody></table>);
    expect(container.querySelectorAll("td").length).toBe(deliverySkeleton.length);
  });
});
