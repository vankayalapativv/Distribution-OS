import { describe, it, expect } from "vitest";
import { computeCustomerErrors } from "./new-customer-validation";
import { EMPTY_CUSTOMER, type NewCustomerFields } from "./new-customer";

const valid: NewCustomerFields = {
  ...EMPTY_CUSTOMER,
  legalName: "Shop",
  phone: "1234567890",
  customerType: "retailer",
  segments: ["Car"],
  addressStreet: "Main St",
  addressCity: "Hyderabad",
  addressPincode: "500001",
  creditLimit: "1000",
  creditDays: "30",
};

describe("computeCustomerErrors", () => {
  it("returns no errors for a complete, valid customer", () => {
    expect(computeCustomerErrors(valid, false, 1, true)).toEqual({});
  });

  it("flags every missing required field", () => {
    const e = computeCustomerErrors(EMPTY_CUSTOMER, false, 0, false);
    expect(e).toMatchObject({
      geo: expect.any(String),
      legalName: expect.any(String),
      phone: expect.any(String),
      customerType: expect.any(String),
      segments: expect.any(String),
      addressStreet: expect.any(String),
      addressCity: expect.any(String),
      addressPincode: expect.any(String),
      creditLimit: expect.any(String),
      creditDays: expect.any(String),
      photos: expect.any(String),
    });
  });

  it("requires a sales executive only for super admins", () => {
    expect(computeCustomerErrors(valid, false, 1, true).salesExecutiveId).toBeUndefined();
    expect(computeCustomerErrors(valid, true, 1, true).salesExecutiveId).toBe("Assign the customer to a sales executive.");
  });

  it("validates phone, alt phone and email format", () => {
    expect(computeCustomerErrors({ ...valid, phone: "12345" }, false, 1, true).phone).toMatch(/10-digit/);
    expect(computeCustomerErrors({ ...valid, alternativePhone: "12345" }, false, 1, true).alternativePhone).toMatch(/10-digit/);
    expect(computeCustomerErrors({ ...valid, email: "nope" }, false, 1, true).email).toMatch(/valid email/);
    expect(computeCustomerErrors({ ...valid, email: "a@b.com" }, false, 1, true).email).toBeUndefined();
  });

  it("validates GST / PAN / Udyam Aadhar lengths", () => {
    expect(computeCustomerErrors({ ...valid, gstNumber: "123" }, false, 1, true).gstNumber).toMatch(/15/);
    expect(computeCustomerErrors({ ...valid, panNumber: "123" }, false, 1, true).panNumber).toMatch(/10/);
    expect(computeCustomerErrors({ ...valid, aadharNumber: "123" }, false, 1, true).aadharNumber).toMatch(/19/);
  });

  it("validates credit limit (>=0) and credit days (whole, >=0)", () => {
    expect(computeCustomerErrors({ ...valid, creditLimit: "-5" }, false, 1, true).creditLimit).toMatch(/valid amount/);
    expect(computeCustomerErrors({ ...valid, creditDays: "1.5" }, false, 1, true).creditDays).toMatch(/whole number/);
    expect(computeCustomerErrors({ ...valid, creditDays: "-1" }, false, 1, true).creditDays).toMatch(/whole number/);
  });

  it("requires at least one shop photo", () => {
    expect(computeCustomerErrors(valid, false, 0, true).photos).toBe("Add at least one photo of the shop.");
  });
});
