import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CellEditDialog, type EditTarget } from "./attendance-cell-dialog";
import type { AttendanceCell } from "./attendance-api";

const cell = (over: Partial<AttendanceCell> = {}): AttendanceCell => ({
  date: "2026-07-28", status: "present", manual: false, tracked: true, startTime: null, endTime: null, startOdometer: null, endOdometer: null, note: null, ...over,
});
const target = (over: Partial<AttendanceCell> = {}): EditTarget => ({
  userId: "u1", name: "Asha", cell: cell(over),
});
const handlers = () => ({ onClose: vi.fn(), onSave: vi.fn(), onClear: vi.fn(), onHolidayAll: vi.fn() });

describe("CellEditDialog", () => {
  it("renders nothing when there is no target", () => {
    render(<CellEditDialog target={null} {...handlers()} saving={false} error={null} />);
    expect(screen.queryByText(/Asha/)).not.toBeInTheDocument();
  });

  it("titles with the name + day and seeds the cell's status/note", () => {
    render(<CellEditDialog target={target({ status: "leave", note: "PL" })} {...handlers()} saving={false} error={null} />);
    expect(screen.getByText(/Asha · Tue, 28 Jul/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("PL")).toBeInTheDocument();
    // Seeded status pill (Leave) is ring-selected.
    expect(screen.getByRole("button", { name: "Leave" }).className).toContain("ring-primary");
  });

  it("shows the day's start + end times (dash for a missing one)", () => {
    render(
      <CellEditDialog
        target={target({ startTime: "2026-07-28T05:21:00Z", endTime: null })}
        {...handlers()}
        saving={false}
        error={null}
      />,
    );
    // Started 10:51 am (IST); no manual End → Ended — (text is split across spans).
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Started 10:51 am · Ended —"),
    ).toBeInTheDocument();
  });

  it("saves the chosen status + note", () => {
    const h = handlers();
    render(<CellEditDialog target={target()} {...h} saving={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Half day" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. approved leave"), { target: { value: "sick" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(h.onSave).toHaveBeenCalledWith("half_day", "sick");
  });

  it("shows Revert to tracked only for a manual cell and calls onClear", () => {
    const h = handlers();
    const { rerender } = render(<CellEditDialog target={target({ manual: false })} {...h} saving={false} error={null} />);
    expect(screen.queryByRole("button", { name: "Revert to tracked" })).not.toBeInTheDocument();
    rerender(<CellEditDialog target={target({ manual: true })} {...h} saving={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Revert to tracked" }));
    expect(h.onClear).toHaveBeenCalled();
  });

  it("cancel closes; an error is shown; Save disabled while saving", () => {
    const h = handlers();
    const { rerender } = render(<CellEditDialog target={target()} {...h} saving={false} error="Nope" />);
    expect(screen.getByText("Nope")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.onClose).toHaveBeenCalled();
    rerender(<CellEditDialog target={target()} {...h} saving={true} error={null} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("dismissing via the dialog (Escape) closes", () => {
    const h = handlers();
    render(<CellEditDialog target={target()} {...h} saving={false} error={null} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(h.onClose).toHaveBeenCalled();
  });

  it("re-seeds when the dialog closes and reopens on a different cell", () => {
    const h = handlers();
    const { rerender } = render(<CellEditDialog target={target({ note: "first" })} {...h} saving={false} error={null} />);
    expect(screen.getByDisplayValue("first")).toBeInTheDocument();
    rerender(<CellEditDialog target={null} {...h} saving={false} error={null} />);
    rerender(<CellEditDialog target={target({ date: "2026-07-29", note: "second" })} {...h} saving={false} error={null} />);
    expect(screen.getByDisplayValue("second")).toBeInTheDocument();
  });
});
