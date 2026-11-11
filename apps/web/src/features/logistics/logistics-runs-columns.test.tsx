import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { runColumns, runSkeleton } from "./logistics-runs-columns";
import type { DeliveryRunRow } from "./logistics-run-types";

const row: DeliveryRunRow = {
  runId: "r1", date: "2026-09-14", driverName: "Ramesh", vehicleNumber: "TS07 UB 4521",
  startedAt: "2026-09-14T02:42:00Z", endedAt: "2026-09-14T10:17:00Z",
  startOdometer: 45210, endOdometer: 45352, distanceKm: 142, status: "ended", stopCount: 9, photoCount: 22,
};

// Render a column's cell against a fake table context.
function renderCell(col: ColumnDef<DeliveryRunRow>, r: DeliveryRunRow) {
  const key = "accessorKey" in col ? (col.accessorKey as keyof DeliveryRunRow) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = { row: { original: r }, getValue: () => (key ? r[key] : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<div>{(col as any).cell(ctx)}</div>);
}

describe("runColumns", () => {
  it("has a cell for every column and a matching skeleton", () => {
    expect(runColumns).toHaveLength(7);
    expect(runSkeleton).toHaveLength(7);
  });

  it("renders driver + vehicle, distance, stops, photos and status", () => {
    const bodies = runColumns.map((c) => renderCell(c, row).container.textContent).join(" | ");
    expect(bodies).toContain("Ramesh");
    expect(bodies).toContain("TS07 UB 4521");
    expect(bodies).toContain("142 km");
    expect(bodies).toContain("9");
    expect(bodies).toContain("22");
    expect(bodies).toContain("Ended");
  });

  it("falls back to a dash for a missing driver/vehicle", () => {
    const { container } = renderCell(runColumns[1], { ...row, driverName: null, vehicleNumber: null });
    expect(container.textContent).toContain("—");
  });

  it("renders every skeleton cell", () => {
    const { container } = render(<table><tbody><tr>{runSkeleton.map((c, i) => <td key={i}>{c()}</td>)}</tr></tbody></table>);
    expect(container.querySelectorAll("td").length).toBe(runSkeleton.length);
  });
});
