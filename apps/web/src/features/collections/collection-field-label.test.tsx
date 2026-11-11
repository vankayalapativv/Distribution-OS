import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldLabel } from "./collection-field-label";

describe("FieldLabel", () => {
  it("renders its text", () => {
    render(<FieldLabel>Amount</FieldLabel>);
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("adds a required asterisk when required", () => {
    const { container } = render(<FieldLabel required>Customer</FieldLabel>);
    expect(container.textContent).toContain("*");
  });

  it("has no asterisk when optional", () => {
    const { container } = render(<FieldLabel>Remarks</FieldLabel>);
    expect(container.textContent).not.toContain("*");
  });
});
