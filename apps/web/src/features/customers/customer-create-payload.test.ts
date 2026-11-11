import { describe, expect, it } from "vitest";
import { buildCustomerPayload, validateCustomer } from "./customer-create-payload";

describe("validateCustomer", () => {
  it("requires at least one segment", () => {
    expect(validateCustomer({ customerType: "retail", segments: [], salesExecutiveId: "u1" })).toBe(
      "Select at least one segment.",
    );
  });
  it("requires a sales executive", () => {
    expect(validateCustomer({ customerType: "retail", segments: ["Car"], salesExecutiveId: "" })).toBe(
      "Assign the customer to a sales executive.",
    );
  });
  it("passes when both are present", () => {
    expect(validateCustomer({ customerType: "retail", segments: ["Car"], salesExecutiveId: "u1" })).toBeNull();
  });
});

describe("buildCustomerPayload", () => {
  it("maps form fields + controlled meta into the POST body", () => {
    const fd = new FormData();
    fd.set("legalName", "Raj Motors");
    fd.set("tradeName", "");
    fd.set("phone", "9876543210");
    fd.set("creditLimit", "50000");
    fd.set("addressCity", "Hyderabad");

    const body = buildCustomerPayload(fd, {
      customerType: "retail",
      segments: ["Car", "2W"],
      salesExecutiveId: "u1",
    });

    expect(body.salesExecutiveId).toBe("u1");
    expect(body.legalName).toBe("Raj Motors");
    expect(body.tradeName).toBeNull(); // blank → null
    expect(body.customerType).toBe("retail");
    expect(body.segment).toBe("Car,2W");
    expect(body.phone).toBe("+919876543210");
    expect(body.creditLimit).toBe(50000);
    expect(body.addressCity).toBe("Hyderabad");
    expect(body.gstNumber).toBeNull();
  });
});
