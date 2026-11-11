import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RowActions } from "./products-row-actions";

describe("RowActions", () => {
  it("fires edit / delete with the row and stops row-click propagation", () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), onRow = vi.fn();
    const row = { id: "x" };
    render(<div onClick={onRow}><RowActions row={row} onEdit={onEdit} onDelete={onDelete} label="product" /></div>);
    fireEvent.click(screen.getByLabelText("Edit product"));
    fireEvent.click(screen.getByLabelText("Delete product"));
    expect(onEdit).toHaveBeenCalledWith(row);
    expect(onDelete).toHaveBeenCalledWith(row);
    expect(onRow).not.toHaveBeenCalled(); // stopPropagation
  });
});
