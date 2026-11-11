import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INFO_TABS, STATUS_TONES } from "./customer-detail-sections";
import type { Customer } from "./customers-api";

const base = {
  legalName: "Raj Motors",
  tradeName: "Raj",
  customerName: "Rajesh",
  phone: "9876543210",
  alternativePhone: null,
  email: null,
  segment: "Car",
  addressStreet: "MG Road",
  addressCity: "Bengaluru",
  addressState: "KA",
  addressPincode: "560001",
  addressLandmark: null,
  gstNumber: null,
  panNumber: null,
  aadharNumber: null,
  paymentStatus: "current",
  kycStatus: "verified",
  approvalStatus: "approved",
} as unknown as Customer;

const render0 = (c: Customer) => render(<>{INFO_TABS[0].render(c)}</>);

describe("INFO_TABS details tab", () => {
  it("maps a known customer type and shows credit terms when positive", () => {
    render0({ ...base, customerType: "retail", creditLimit: 50000, creditDays: 30 });
    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("₹50,000")).toBeInTheDocument();
  });

  it("passes an unknown type through and blanks zero credit", () => {
    render0({ ...base, customerType: "wholesale", creditLimit: 0, creditDays: 0 });
    expect(screen.getByText("wholesale")).toBeInTheDocument();
    // Credit Limit + Credit Days both render em dashes when zero.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});

describe("STATUS_TONES", () => {
  it("has a tone per customer status", () => {
    expect(STATUS_TONES.active).toContain("green");
    expect(STATUS_TONES.inactive).toBeTruthy();
    expect(STATUS_TONES.suspended).toContain("red");
  });
});
