import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RowActions } from "./products-row-actions";

describe("RowActions", () => {
  it("fires edit / delete from the ⋮ menu with the row, and stops row-click propagation", () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), onRow = vi.fn();
    const row = { id: "x" };
    render(<div onClick={onRow}><RowActions row={row} onEdit={onEdit} onDelete={onDelete} label="product" /></div>);

    fireEvent.click(screen.getByTitle("Actions")); // open the kebab
    fireEvent.click(screen.getByLabelText("Edit product"));
    expect(onEdit).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByTitle("Actions")); // reopen (closes on select)
    fireEvent.click(screen.getByLabelText("Delete product"));
    expect(onDelete).toHaveBeenCalledWith(row);

    expect(onRow).not.toHaveBeenCalled(); // stopPropagation on the wrapper
  });

  it("keeps the menu closed until the trigger is clicked", () => {
    render(<RowActions row={{ id: "y" }} onEdit={vi.fn()} onDelete={vi.fn()} label="product" />);
    expect(screen.queryByLabelText("Edit product")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Actions"));
    expect(screen.getByLabelText("Edit product")).toBeInTheDocument();
  });

  it("stops keydown from bubbling past its wrapper (never reaches the row)", () => {
    const onKey = vi.fn();
    render(<div onKeyDown={onKey}><RowActions row={{ id: "z" }} onEdit={vi.fn()} onDelete={vi.fn()} label="product" /></div>);
    fireEvent.keyDown(screen.getByTitle("Actions"));
    expect(onKey).not.toHaveBeenCalled();
  });
});
