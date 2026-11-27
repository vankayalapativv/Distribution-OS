import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhoneField, toLocalPhone, toStoredPhone } from "./phone-field";

describe("toLocalPhone", () => {
  it("strips +91 / 91 and non-digits to the 10-digit local part", () => {
    expect(toLocalPhone("+919876543210")).toBe("9876543210");
    expect(toLocalPhone("91 98765 43210")).toBe("9876543210");
    expect(toLocalPhone("98765-43210")).toBe("9876543210");
    expect(toLocalPhone(null)).toBe("");
    expect(toLocalPhone(undefined)).toBe("");
  });
});

describe("toStoredPhone", () => {
  it("formats a local part as +91… (null when empty)", () => {
    expect(toStoredPhone("9876543210")).toBe("+919876543210");
    expect(toStoredPhone("98765432109999")).toBe("+919876543210"); // capped at 10
    expect(toStoredPhone("")).toBeNull();
  });
});

describe("PhoneField", () => {
  it("renders the label, +91 prefix, and a required marker", () => {
    render(<PhoneField label="Phone" value="" onChange={() => {}} required error="Bad number" />);
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Bad number")).toBeInTheDocument();
  });

  it("sanitizes input to at most 10 digits", () => {
    const onChange = vi.fn();
    render(<PhoneField label="Phone" value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("10-digit phone number"), {
      target: { value: "98a76-54321099" },
    });
    expect(onChange).toHaveBeenCalledWith("9876543210");
  });
});
