import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangeSheet, rangeLabel } from "./date-range-sheet";

describe("rangeLabel", () => {
  it("formats a single day and a span", () => {
    expect(rangeLabel("2026-11-27", "2026-11-27")).toMatch(/27 Nov 2026/);
    expect(rangeLabel("2026-11-01", "2026-11-27")).toMatch(/1 Nov 2026 – 27 Nov 2026/);
  });

  it("defaults a partial date's missing month/day to 1", () => {
    // parseYmd("2026") → Jan 1 2026 via the ?? 1 fallbacks.
    expect(rangeLabel("2026", "2026")).toMatch(/1 Jan 2026/);
  });
});

const open = (over: Partial<Parameters<typeof DateRangeSheet>[0]> = {}) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <DateRangeSheet visible from="2026-11-10" to="2026-11-10" onApply={onApply} onClose={onClose} {...over} />,
  );
  return { onApply, onClose };
};

describe("DateRangeSheet", () => {
  it("picks a fresh start then an end and applies the span", () => {
    const { onApply } = open();
    // A complete range is pre-set (10–10) → the first tap starts fresh.
    fireEvent.click(screen.getByText("12"));
    fireEvent.click(screen.getByText("18")); // later → closes the range
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith("2026-11-12", "2026-11-18");
  });

  it("restarts the range when the second tap is before the start", () => {
    const { onApply } = open();
    fireEvent.click(screen.getByText("15")); // fresh start
    fireEvent.click(screen.getByText("8")); // earlier → becomes the new start
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith("2026-11-08", "2026-11-08"); // single-day range
  });

  it("closes on Cancel and on the backdrop, but a card tap is swallowed", () => {
    const { onClose } = open();
    fireEvent.click(screen.getByText("Select date range")); // inner card tap → no close
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render its content when hidden", () => {
    const { onApply } = open({ visible: false });
    expect(screen.queryByText("Select date range")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("prompts for a start and disables Apply when no range is set", () => {
    const { onApply } = open({ from: null as unknown as string, to: null as unknown as string });
    expect(screen.getByText("Tap a start date")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply")); // disabled → no-op
    expect(onApply).not.toHaveBeenCalled();
  });
});
