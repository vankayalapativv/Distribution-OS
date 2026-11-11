import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { oilColumns, oilSkeleton } from "./oil-columns";
import type { ManagedProduct } from "./products-api";

const product = (over: Partial<ManagedProduct> = {}): ManagedProduct =>
  ({ id: "p1", productName: "Fuchs 5W30", brand: "Fuchs", unit: "litres", segments: ["Cars"], packs: [], status: "active", createdAt: "x", ...over } as ManagedProduct);

function renderCell(col: ColumnDef<ManagedProduct>, r: ManagedProduct) {
  const key = "accessorKey" in col ? (col.accessorKey as keyof ManagedProduct) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = { row: { original: r }, getValue: () => (key ? r[key] : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<table><tbody><tr>{(col as any).cell(ctx)}</tr></tbody></table>);
}

const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), canManage: true };

describe("oilColumns", () => {
  const cols = oilColumns(handlers);

  it("renders name, brand and segments (with empty fallbacks)", () => {
    expect(renderCell(cols[0], product()).container.textContent).toContain("Fuchs 5W30");
    expect(renderCell(cols[1], product({ brand: "" })).container.textContent).toContain("—");
    expect(renderCell(cols[2], product({ segments: [] })).container.textContent).toContain("—");
    expect(renderCell(cols[2], product({ segments: ["Cars", "2W"] })).container.textContent).toContain("2W");
  });

  it("shows 'By the piece' for a quantity product", () => {
    expect(renderCell(cols[3], product({ unit: "quantity" })).container.textContent).toContain("By the piece");
  });

  it("lists pack sizes, and a dash when there are none", () => {
    const packs = [{ packSize: 1 }, { packSize: 5 }, { packSize: 20 }] as ManagedProduct["packs"];
    const text = renderCell(cols[3], product({ packs })).container.textContent ?? "";
    expect(text).toContain("1 L");
    expect(text).toContain("5 L");
    expect(text).toContain("20 L");
    expect(renderCell(cols[3], product({ packs: [] })).container.textContent).toContain("—");
  });

  it("shows row actions only when allowed", () => {
    const onEdit = vi.fn();
    const cell = renderCell(oilColumns({ onEdit, onDelete: vi.fn(), canManage: true })[4], product());
    fireEvent.click(cell.getByLabelText("Edit product"));
    expect(onEdit).toHaveBeenCalled();
    expect(renderCell(oilColumns({ onEdit, onDelete: vi.fn(), canManage: false })[4], product()).container.textContent).toContain("—");
  });

  it("has a skeleton cell per column", () => {
    expect(oilSkeleton).toHaveLength(cols.length);
    const { container } = render(<table><tbody><tr>{oilSkeleton.map((c, i) => <td key={i}>{c()}</td>)}</tr></tbody></table>);
    expect(container.querySelectorAll("td")).toHaveLength(oilSkeleton.length);
  });
});
