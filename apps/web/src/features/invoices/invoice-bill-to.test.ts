import { describe, it, expect } from "vitest";
import { billToView } from "./invoice-bill-to";
import type { CustomerDetail } from "./invoice-generate-api";

const cust = (over: Partial<CustomerDetail> = {}): CustomerDetail => ({
  id: "c", legalName: "Shop", tradeName: null, customerName: null, customerCode: "C1",
  gstNumber: null, panNumber: null, phone: null, alternativePhone: null, email: null,
  addressStreet: null, addressCity: null, addressState: null, addressPincode: null, addressLandmark: null,
  creditLimit: 0, creditDays: 0, salesExecutiveName: null, totalOutstanding: 0, creditBlocked: false, creditOverdueDays: 0,
  ...over,
});

describe("billToView", () => {
  it("has no GST identity and empty lines for a bare customer", () => {
    const v = billToView(cust(), "intra");
    expect(v.hasGst).toBe(false);
    expect(v.addr).toEqual([]);
    expect(v.contact).toEqual([]);
    expect(v.owes).toBe(false);
    expect(v.inCredit).toBe(false);
  });
  it("sets the GST badge + tax line by supply type", () => {
    expect(billToView(cust({ gstNumber: "36ABCDE1234F1Z5" }), "intra")).toMatchObject({
      hasGst: true, badge: "CGST+SGST", taxLine: expect.stringContaining("Intra-state"),
    });
    expect(billToView(cust({ gstNumber: "29ABCDE1234F1Z5" }), "inter")).toMatchObject({
      badge: "IGST", taxLine: expect.stringContaining("Inter-state"),
    });
  });
  it("builds address lines, dropping blanks", () => {
    const v = billToView(cust({ addressStreet: "Main St", addressCity: "Hyderabad", addressState: "TG", addressPincode: "500001" }), "intra");
    expect(v.addr).toEqual(["Main St", "Hyderabad", "TG — 500001"]);
  });
  it("builds contact lines in order with stable keys", () => {
    const v = billToView(cust({ customerName: "Bala", phone: "123", email: "a@b.com", salesExecutiveName: "SE" }), "intra");
    expect(v.contact.map((c) => c.key)).toEqual(["attn", "phone", "email", "se"]);
  });
  it("flags owes vs in-credit from the outstanding balance", () => {
    expect(billToView(cust({ totalOutstanding: 100 }), "intra")).toMatchObject({ owes: true, inCredit: false });
    expect(billToView(cust({ totalOutstanding: -50 }), "intra")).toMatchObject({ owes: false, inCredit: true });
  });
});
