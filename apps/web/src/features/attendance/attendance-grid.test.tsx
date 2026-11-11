import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const g = {
  today: "2026-07-15", isLoading: false,
  days: [], rows: [], dayMeta: [], edit: null as unknown, setEdit: vi.fn(),
  saveCell: vi.fn(), clearCell: vi.fn(), saving: false, error: null,
};
vi.mock("./use-attendance-grid", () => ({ useAttendanceGrid: () => g }));
vi.mock("./attendance-controls", () => ({ StatusLegend: () => <div>legend</div> }));
vi.mock("./attendance-grid-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AttendanceGridTable: ({ onEdit, canEdit }: any) => (
    <button onClick={() => onEdit({ id: "x" })}>table canEdit={String(canEdit)}</button>
  ),
}));
vi.mock("./attendance-cell-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CellEditDialog: ({ onClose, onSave, onClear }: any) => (
    <div>
      dialog
      <button onClick={onClose}>d-close</button>
      <button onClick={() => onSave("present", "n")}>d-save</button>
      <button onClick={onClear}>d-clear</button>
    </div>
  ),
}));

import { AttendanceGrid } from "./attendance-grid";

const config = { apiBaseUrl: "", authToken: "" };

describe("AttendanceGrid", () => {
  it("renders table + legend and the edit dialog for a Super Admin", () => {
    render(<AttendanceGrid actionConfig={config} role="SUPER_ADMIN" month="2026-07" />);
    expect(screen.getByText("table canEdit=true")).toBeInTheDocument();
    expect(screen.getByText("legend")).toBeInTheDocument();
    expect(screen.getByText("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("table canEdit=true")); // onEdit → setEdit
    expect(g.setEdit).toHaveBeenCalledWith({ id: "x" });
    fireEvent.click(screen.getByText("d-close"));
    expect(g.setEdit).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("d-save"));
    expect(g.saveCell).toHaveBeenCalledWith("present", "n");
    fireEvent.click(screen.getByText("d-clear"));
    expect(g.clearCell).toHaveBeenCalled();
  });

  it("hides the dialog and disables editing for a Manager", () => {
    render(<AttendanceGrid actionConfig={config} role="MANAGER" month="2026-07" />);
    expect(screen.getByText("table canEdit=false")).toBeInTheDocument();
    expect(screen.queryByText("dialog")).not.toBeInTheDocument();
  });
});
