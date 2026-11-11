import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerFormFields } from "./customers-form-fields";

describe("CustomerFormFields", () => {
  it("renders every labelled section and its key fields", () => {
    render(
      <CustomerFormFields customerType="mechanic" setCustomerType={vi.fn()} segments={["Car"]} setSegments={vi.fn()} />,
    );
    for (const section of ["Identity", "Contact", "Classification", "Tax IDs", "Address", "Credit"]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
    expect(screen.getByText(/Legal Name/)).toBeInTheDocument();
    expect(screen.getByText(/GST Number/)).toBeInTheDocument();
    // The segment picker is embedded (Car selected).
    expect(screen.getByRole("button", { name: "Car" })).toBeInTheDocument();
  });
});
