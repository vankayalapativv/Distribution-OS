import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError, fieldErrorProps } from "./field-error";

describe("FieldError", () => {
  it("renders the message only when shown and present", () => {
    const { rerender } = render(<FieldError id="e" show message="Required." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");
    rerender(<FieldError id="e" show={false} message="Required." />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<FieldError id="e" show message={undefined} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("fieldErrorProps", () => {
  it("wires aria-invalid + describedby only when shown and present", () => {
    expect(fieldErrorProps("e", true, "x")).toEqual({ "aria-invalid": true, "aria-describedby": "e" });
    expect(fieldErrorProps("e", false, "x")).toEqual({ "aria-invalid": undefined, "aria-describedby": undefined });
    expect(fieldErrorProps("e", true, undefined)).toEqual({ "aria-invalid": undefined, "aria-describedby": undefined });
  });
});
