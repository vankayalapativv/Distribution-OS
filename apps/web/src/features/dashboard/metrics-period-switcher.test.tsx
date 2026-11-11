import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricsPeriodSwitcher } from "./metrics-period-switcher";

function setup(overrides: Partial<Parameters<typeof MetricsPeriodSwitcher>[0]> = {}) {
  const onPreset = vi.fn();
  const onCalOpenChange = vi.fn();
  const onCalendar = vi.fn();
  render(
    <MetricsPeriodSwitcher
      preset="today"
      range={{ from: "2026-09-15", to: "2026-09-15" }}
      calOpen={false}
      calRange={undefined}
      onPreset={onPreset}
      onCalOpenChange={onCalOpenChange}
      onCalendar={onCalendar}
      {...overrides}
    />,
  );
  return { onPreset, onCalOpenChange, onCalendar };
}

describe("MetricsPeriodSwitcher", () => {
  it("renders the three presets and marks the active one", () => {
    setup();
    const today = screen.getByRole("button", { name: "today" });
    const week = screen.getByRole("button", { name: "week" });
    // Active preset uses the white pill; inactive presets are muted (both branches).
    expect(today.className).toContain("bg-white");
    expect(week.className).toContain("text-muted-foreground");
  });

  it("fires onPreset with the chosen preset", () => {
    const { onPreset } = setup();
    fireEvent.click(screen.getByRole("button", { name: "month" }));
    expect(onPreset).toHaveBeenCalledWith("month");
  });

  it("shows the current range label on the calendar trigger", () => {
    setup({ range: { from: "2026-09-15", to: "2026-09-15" } });
    // Single-day range → no dash separator.
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});
