import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PeriodToggle } from "./period-toggle";

describe("PeriodToggle", () => {
  it("marks the active period and emits changes", () => {
    const onChange = vi.fn();
    render(<PeriodToggle period="week" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Weekly" }).className).toContain("bg-primary");
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(onChange).toHaveBeenCalledWith("month");
  });
});
