import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TargetSegmentInputs } from "./target-segment-inputs";

describe("TargetSegmentInputs", () => {
  it("renders a labelled input per oil segment and reports edits", () => {
    const onChange = vi.fn();
    render(<TargetSegmentInputs segments={{ Car: "10" }} onChange={onChange} />);
    for (const s of ["Car", "2W", "3W", "Commercial", "Agri", "Gear Oil"]) {
      expect(screen.getByLabelText(s)).toBeInTheDocument();
    }
    const car = screen.getByLabelText("Car") as HTMLInputElement;
    expect(car.value).toBe("10");
    fireEvent.change(car, { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith("Car", "25");
  });
});
