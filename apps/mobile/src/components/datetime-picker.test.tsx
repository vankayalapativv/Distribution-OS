import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Stepper } from "./datetime-stepper";
import { DateTimePickerCard } from "./datetime-picker";

describe("Stepper", () => {
  it("fires onUp / onDown", () => {
    const onUp = vi.fn();
    const onDown = vi.fn();
    const { container } = render(<Stepper value="07" onUp={onUp} onDown={onDown} />);
    expect(screen.getByText("07")).toBeInTheDocument();
    const buttons = container.querySelectorAll('[role="button"], div[tabindex]');
    // Fall back to clicking the two chevron glyphs by their aria-label.
    fireEvent.click(screen.getByLabelText("chevron-up"));
    fireEvent.click(screen.getByLabelText("chevron-down"));
    expect(onUp).toHaveBeenCalled();
    expect(onDown).toHaveBeenCalled();
    expect(buttons.length).toBeGreaterThan(0);
  });
});

const open = (over: Partial<Parameters<typeof DateTimePickerCard>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DateTimePickerCard
      visible
      initial={new Date(2026, 10, 27, 9, 30)} // 27 Nov 2026, 9:30 AM
      title="Remind me"
      message="Pick a time"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onConfirm, onCancel };
};

describe("DateTimePickerCard", () => {
  it("shows the title, message and the initial summary", () => {
    open();
    expect(screen.getByText("Remind me")).toBeInTheDocument();
    expect(screen.getByText("Pick a time")).toBeInTheDocument();
    expect(screen.getByText(/9:30 AM/)).toBeInTheDocument();
  });

  it("steps the hour and minute and toggles the meridiem", () => {
    open();
    fireEvent.click(screen.getAllByLabelText("chevron-up")[0]); // hour 9 → 10
    expect(screen.getByText(/10:30 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("chevron-up")[1]); // minute 30 → 35
    expect(screen.getByText(/10:35 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("PM")); // meridiem
    expect(screen.getByText(/10:35 PM/)).toBeInTheDocument();
  });

  it("wraps the hour and minute steppers at their bounds", () => {
    open({ initial: new Date(2026, 10, 27, 0, 0) }); // 12:00 AM
    const [hourDown, minuteDown] = screen.getAllByLabelText("chevron-down");
    fireEvent.click(hourDown); // 12 → 11
    expect(screen.getByText(/11:00 AM/)).toBeInTheDocument();
    fireEvent.click(minuteDown); // 00 → 55
    expect(screen.getByText(/11:55 AM/)).toBeInTheDocument();
  });

  it("wraps the hour down from 1 to 12", () => {
    open({ initial: new Date(2026, 10, 27, 1, 0) }); // 1:00 AM
    fireEvent.click(screen.getAllByLabelText("chevron-down")[0]); // hour 1 → 12
    expect(screen.getByText(/12:00 AM/)).toBeInTheDocument();
  });

  it("confirms the chosen moment as an ISO string", () => {
    const { onConfirm } = open();
    fireEvent.click(screen.getByText("Set reminder"));
    expect(onConfirm).toHaveBeenCalledWith(expect.stringMatching(/^2026-11-27T/));
  });

  it("cancels, and a card tap is swallowed", () => {
    const { onCancel } = open();
    fireEvent.click(screen.getByText("Remind me")); // inner card tap → no cancel
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Not now"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders no message line when none is given", () => {
    render(
      <DateTimePickerCard visible initial={new Date(2026, 10, 27, 9, 30)} title="Schedule it" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText("Schedule it")).toBeInTheDocument();
    expect(screen.queryByText("Pick a time")).not.toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    render(
      <DateTimePickerCard visible={false} initial={new Date(2026, 10, 27, 9, 30)} title="Schedule it" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByText("Schedule it")).not.toBeInTheDocument();
  });
});
