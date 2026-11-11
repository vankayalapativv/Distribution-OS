import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CUSTOMER_SEGMENTS, CustomerSegmentPicker, onTypeChange } from "./customer-segment-picker";

describe("onTypeChange", () => {
  it("sets a chosen type but ignores a null clear", () => {
    const set = vi.fn();
    onTypeChange(set)("retail");
    expect(set).toHaveBeenCalledWith("retail");
    onTypeChange(set)(null);
    expect(set).toHaveBeenCalledTimes(1);
  });
});

describe("CustomerSegmentPicker", () => {
  it("highlights selected segments and shows every option", () => {
    render(<CustomerSegmentPicker segments={["Car"]} setSegments={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(CUSTOMER_SEGMENTS.length);
    expect(screen.getByRole("button", { name: "Car" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "2W" }).className).toContain("bg-background");
  });

  it("adds an off segment and removes an on segment", () => {
    const setSegments = vi.fn();
    render(<CustomerSegmentPicker segments={["Car"]} setSegments={setSegments} />);

    fireEvent.click(screen.getByRole("button", { name: "2W" })); // off → add
    expect(setSegments.mock.calls[0][0](["Car"])).toEqual(["Car", "2W"]);

    fireEvent.click(screen.getByRole("button", { name: "Car" })); // on → remove
    expect(setSegments.mock.calls[1][0](["Car", "2W"])).toEqual(["2W"]);
  });
});
