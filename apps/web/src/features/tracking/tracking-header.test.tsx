import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/expenditures/expenditure-date-picker", () => ({
  DatePicker: ({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) => (
    <button data-testid="date" data-value={value} onClick={() => onChange("2026-09-10")}>date</button>
  ),
}));

import { TrackingHeader } from "./tracking-header";

const base = { view: "map" as const, setView: vi.fn(), date: "2026-09-14", setDate: vi.fn(), onRefresh: vi.fn() };

describe("TrackingHeader", () => {
  it("switches between Map and Device health", () => {
    const setView = vi.fn();
    render(<TrackingHeader {...base} setView={setView} />);
    fireEvent.click(screen.getByText("Device health"));
    expect(setView).toHaveBeenCalledWith("health");
    fireEvent.click(screen.getByText("Map"));
    expect(setView).toHaveBeenCalledWith("map");
  });

  it("changes the date and refreshes", () => {
    const setDate = vi.fn();
    const onRefresh = vi.fn();
    render(<TrackingHeader {...base} setDate={setDate} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("date"));
    fireEvent.click(screen.getByText("Refresh"));
    expect(setDate).toHaveBeenCalledWith("2026-09-10");
    expect(onRefresh).toHaveBeenCalled();
  });

  it("highlights the active view tab", () => {
    render(<TrackingHeader {...base} view="health" />);
    expect(screen.getByText("Device health").className).toMatch(/bg-primary/);
    expect(screen.getByText("Map").className).not.toMatch(/bg-primary/);
  });
});
