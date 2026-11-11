import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerEditFormFields } from "./customer-edit-form-fields";
import type { Customer } from "./customers-api";

const customer = (over: Partial<Customer> = {}): Customer =>
  ({
    id: "c1",
    legalName: "Raj Motors",
    tradeName: null,
    customerName: null,
    customerType: "retail",
    segment: "Car",
    phone: "+919876543210",
    alternativePhone: null,
    gstNumber: null,
    panNumber: null,
    aadharNumber: null,
    addressStreet: null,
    addressCity: "Hyderabad",
    addressState: null,
    addressPincode: null,
    addressLandmark: null,
    email: null,
    creditLimit: 50000,
    creditDays: 0,
    ...over,
  }) as unknown as Customer;

const renderFields = (c: Customer) =>
  render(
    <CustomerEditFormFields
      customer={c}
      customerType={c.customerType}
      setCustomerType={vi.fn()}
      segments={["Car"]}
      setSegments={vi.fn()}
    />,
  );

describe("CustomerEditFormFields", () => {
  it("renders every section and prefills values", () => {
    renderFields(customer());
    for (const label of ["Identity", "Contact", "Classification", "Tax IDs", "Address", "Credit"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect((screen.getByLabelText(/Legal Name/) as HTMLInputElement).value).toBe("Raj Motors");
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("Hyderabad");
    // last10 strips the +91 prefix
    expect((screen.getByLabelText("Phone Number") as HTMLInputElement).value).toBe("9876543210");
    // creditLimit > 0 shows the number; creditDays 0 shows blank
    expect((screen.getByLabelText("Credit Limit (₹)") as HTMLInputElement).value).toBe("50000");
    expect((screen.getByLabelText("Credit Days") as HTMLInputElement).value).toBe("");
  });

  it("blanks the credit limit when zero and shows credit days when positive", () => {
    renderFields(customer({ creditLimit: 0, creditDays: 45, addressCity: null }));
    expect((screen.getByLabelText("Credit Limit (₹)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Credit Days") as HTMLInputElement).value).toBe("45");
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
  });
});
