import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpenditureRowActions } from "./expenditure-row-actions";
import type { Expenditure } from "./expenditures-api";

const entry = (over: Partial<Expenditure> = {}): Expenditure =>
  ({ id: "e1", expenditureCode: "EXP-9", hasBill: true, ...over } as Expenditure);

const render1 = (over: Partial<Expenditure> = {}, h: Partial<Record<"onEdit" | "onDelete" | "onViewBill", () => void>> = {}) => {
  const onEdit = h.onEdit ?? vi.fn(), onDelete = h.onDelete ?? vi.fn(), onViewBill = h.onViewBill ?? vi.fn(), rowClick = vi.fn();
  render(
    <div onClick={rowClick} onKeyDown={rowClick}>
      <ExpenditureRowActions entry={entry(over)} onEdit={onEdit} onDelete={onDelete} onViewBill={onViewBill} />
    </div>,
  );
  return { onEdit, onDelete, onViewBill, rowClick };
};

describe("ExpenditureRowActions", () => {
  it("opens the ⋮ menu and fires View bill / Edit / Delete, never bubbling to the row", () => {
    const e = entry();
    const { onEdit, onDelete, onViewBill, rowClick } = render1();
    expect(screen.queryByRole("button", { name: "Edit EXP-9" })).not.toBeInTheDocument(); // closed

    fireEvent.click(screen.getByTitle("Actions"));
    fireEvent.click(screen.getByRole("button", { name: "View bill for EXP-9" }));
    expect(onViewBill).toHaveBeenCalledWith(e);

    fireEvent.click(screen.getByTitle("Actions"));
    fireEvent.click(screen.getByRole("button", { name: "Edit EXP-9" }));
    expect(onEdit).toHaveBeenCalledWith(e);

    fireEvent.click(screen.getByTitle("Actions"));
    fireEvent.click(screen.getByRole("button", { name: "Delete EXP-9" }));
    expect(onDelete).toHaveBeenCalledWith(e);

    fireEvent.keyDown(screen.getByTitle("Actions"));
    expect(rowClick).not.toHaveBeenCalled(); // click + keydown both stopped at the wrapper
  });

  it("hides View bill when the entry has no bill", () => {
    render1({ hasBill: false });
    fireEvent.click(screen.getByTitle("Actions"));
    expect(screen.queryByRole("button", { name: "View bill for EXP-9" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit EXP-9" })).toBeInTheDocument();
  });
});
