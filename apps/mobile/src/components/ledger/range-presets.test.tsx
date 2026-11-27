import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RangePresets } from "./range-presets";

describe("RangePresets", () => {
  it("renders every preset and selects one on tap", () => {
    const onSelect = vi.fn();
    render(<RangePresets preset="this-month" onSelect={onSelect} />);
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByText("All time")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Last 3 months"));
    expect(onSelect).toHaveBeenCalledWith("last-3-months");
  });
});
