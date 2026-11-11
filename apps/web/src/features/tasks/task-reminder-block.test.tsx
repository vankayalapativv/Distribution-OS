import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/expenditures/expenditure-date-picker", () => ({
  DatePicker: ({ onChange }: { readonly onChange: (v: string) => void }) => <button onClick={() => onChange("2026-09-20")}>date</button>,
}));

import { TaskReminderBlock } from "./task-reminder-block";

const base = { assigneeName: "Sandeep", dueDate: "", setDueDate: vi.fn(), time: "", setTime: vi.fn(), remindPreview: null };

describe("TaskReminderBlock", () => {
  it("names the SE and prompts when timing is incomplete", () => {
    render(<TaskReminderBlock {...base} />);
    expect(screen.getByText(/Remind Sandeep/)).toBeInTheDocument();
    expect(screen.getByText(/Pick a date and time/)).toBeInTheDocument();
  });

  it("shows the rings-at preview when set", () => {
    render(<TaskReminderBlock {...base} remindPreview="20 Sep, 2:30 PM" />);
    expect(screen.getByText(/Rings at 20 Sep, 2:30 PM/)).toBeInTheDocument();
  });

  it("edits the date and time", () => {
    const setDueDate = vi.fn(), setTime = vi.fn();
    render(<TaskReminderBlock {...base} setDueDate={setDueDate} setTime={setTime} />);
    fireEvent.click(screen.getByText("date"));
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: "14:30" } });
    expect(setDueDate).toHaveBeenCalledWith("2026-09-20");
    expect(setTime).toHaveBeenCalledWith("14:30");
  });
});
