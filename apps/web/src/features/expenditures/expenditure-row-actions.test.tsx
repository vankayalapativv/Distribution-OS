import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpenditureRowActions } from "./expenditure-row-actions";
import type { Expenditure } from "./expenditures-api";

const entry = { id: "e1", expenditureCode: "EXP-9" } as Expenditure;

describe("ExpenditureRowActions", () => {
  it("edits and deletes without bubbling to the row", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <ExpenditureRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit EXP-9" }));
    expect(onEdit).toHaveBeenCalledWith(entry);
    fireEvent.click(screen.getByRole("button", { name: "Delete EXP-9" }));
    expect(onDelete).toHaveBeenCalledWith(entry);
    expect(rowClick).not.toHaveBeenCalled(); // stopPropagation
  });
});
