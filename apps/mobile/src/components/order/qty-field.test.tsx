import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QtyField } from "./qty-field";

describe("QtyField", () => {
  it("steps up / down (floored at 1) and edits directly", () => {
    const onChange = vi.fn();
    render(<QtyField value="3" onChange={onChange} />);
    fireEvent.click(screen.getByText("＋"));
    expect(onChange).toHaveBeenCalledWith("4");
    fireEvent.click(screen.getByText("−"));
    expect(onChange).toHaveBeenCalledWith("2");
    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith("9");
  });

  it("floors a down-step at 1 and treats invalid text as 1", () => {
    const onChange = vi.fn();
    const { rerender } = render(<QtyField value="1" onChange={onChange} />);
    fireEvent.click(screen.getByText("−"));
    expect(onChange).toHaveBeenCalledWith("1"); // can't go below 1
    rerender(<QtyField value="abc" onChange={onChange} compact />); // invalid → destructive border, step from 1
    fireEvent.click(screen.getByText("＋"));
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("renders the compact variant with a valid value", () => {
    render(<QtyField value="5" onChange={() => {}} compact />);
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  });
});
