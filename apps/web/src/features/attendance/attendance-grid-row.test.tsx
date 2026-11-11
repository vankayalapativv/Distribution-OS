import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceGridRow } from "./attendance-grid-row";
import type { AttendanceCell, AttendanceGridRow as Row } from "./attendance-api";

const cell = (over: Partial<AttendanceCell>): AttendanceCell => ({
  date: "2026-07-01", status: "present", manual: false, tracked: true, startTime: null, endTime: null, startOdometer: null, endOdometer: null, note: null, ...over,
});
const row: Row = {
  userId: "u1",
  name: "Asha",
  days: [
    cell({ date: "2026-07-01", status: "present" }),
    cell({ date: "2026-07-02", status: "present" }),
    cell({ date: "2026-07-03", status: "absent", manual: true }),
    cell({ date: "2026-07-04", status: null }), // future/locked
  ],
};
const renderRow = (canEdit: boolean, onEdit = vi.fn()) => {
  render(
    <table><tbody><AttendanceGridRow row={row} today="2026-07-01" canEdit={canEdit} onEdit={onEdit} /></tbody></table>,
  );
  return onEdit;
};

describe("AttendanceGridRow", () => {
  it("renders the name, a cell per day, and Hrs/Km/Days totals", () => {
    renderRow(false);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(4);
    // Present days / total working days = 2 present / (2 present + 1 absent) = "2 / 3".
    // No times → Hrs/Km show "—".
    const cells = screen.getByRole("row").querySelectorAll("td");
    expect(cells[cells.length - 1]).toHaveTextContent("2 / 3");
  });

  it("edits a past cell when allowed; future + read-only cells stay locked", () => {
    const onEdit = renderRow(true);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // 2026-07-01, present
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", name: "Asha" }));
    expect(buttons[3]).toBeDisabled(); // the future/null cell
  });

  it("does not edit when canEdit is false", () => {
    const onEdit = renderRow(false);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
