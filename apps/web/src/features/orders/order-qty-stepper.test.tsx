import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderQtyStepper } from "./order-qty-stepper";

describe("OrderQtyStepper", () => {
  it("steps up and down through the buttons", () => {
    const onStep = vi.fn();
    render(<OrderQtyStepper value={2} onStep={onStep} onSet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("reports typed numeric values", () => {
    const onSet = vi.fn();
    render(<OrderQtyStepper value={0} onSet={onSet} onStep={() => {}} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
    expect(onSet).toHaveBeenCalledWith(5);
  });

  it("shows a blank field for a zero value", () => {
    render(<OrderQtyStepper value={0} onSet={() => {}} onStep={() => {}} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });

  it("disables the control and marks the field invalid on request", () => {
    render(<OrderQtyStepper value={3} disabled invalid onSet={() => {}} onStep={() => {}} />);
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByRole("spinbutton").className).toContain("border-destructive");
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });
});
