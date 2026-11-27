import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldError } from "./field-error";

describe("FieldError", () => {
  it("renders the message when present, nothing when absent", () => {
    const { container, rerender } = render(<FieldError message="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    rerender(<FieldError />);
    expect(container.textContent).toBe("");
  });
});
