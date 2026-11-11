import { describe, expect, it } from "vitest";
import { buildCustomersOptions, dues, oldest, rowDues } from "./customers-list-pdf-data";
import type { Customer } from "./customers-api";

const C = (o: Partial<Customer>): Customer => ({
  id: "c", customerCode: "C-1", legalName: "Ravi Motors", tradeName: null, customerName: null,
  customerType: "mechanic", segment: "Cars", phone: null, alternativePhone: null, gstNumber: null,
  panNumber: null, aadharNumber: null, addressStreet: null, addressCity: "Guntur", addressState: null,
  addressPincode: null, addressLandmark: null, email: null, customerGrade: null,
  creditLimit: 0, creditDays: 0, paymentStatus: "clear", kycStatus: "ok", approvalStatus: "approved",
  status: "active", createdBy: null, salesExecutiveName: "Ravi", collectionDues: 0, hasBusiness: true,
  oldestUnpaidDays: null, ...o,
});

describe("dues", () => {
  it("is Dr for a debit, Cr for a credit, 0 when settled", () => {
    expect(dues(500)).toBe("500.00 Dr");
    expect(dues(-500)).toBe("500.00 Cr");
    expect(dues(0)).toBe("0");
  });
});

describe("rowDues", () => {
  it("shows a dash for a settled ₹0 with no business, else 0", () => {
    expect(rowDues(0, false)).toBe("—");
    expect(rowDues(0, true)).toBe("0");
    expect(rowDues(0, undefined)).toBe("0");
    expect(rowDues(300, true)).toBe("300.00 Dr");
    expect(rowDues(-300, true)).toBe("300.00 Cr");
  });
});

describe("oldest", () => {
  it("dashes null, singular/plural days otherwise", () => {
    expect(oldest(null)).toBe("—");
    expect(oldest(1)).toBe("1 day");
    expect(oldest(9)).toBe("9 days");
  });
});

describe("buildCustomersOptions", () => {
  it("maps each customer, defaulting missing fields; single-row meta is singular", () => {
    const o = buildCustomersOptions([C({ customerType: "retail" })], "All customers");
    expect(o.body).toHaveLength(1);
    expect(o.metaLine).toContain("1 customer  ·");
    expect(JSON.stringify(o.body[0])).toContain("Retail"); // known type label
  });

  it("falls back for unknown/blank fields and pluralises the count", () => {
    const o = buildCustomersOptions(
      [
        C({ customerType: "unknown-type", collectionDues: 100 }),
        C({ collectionDues: undefined as unknown as number, hasBusiness: false, oldestUnpaidDays: 1 }), // dues ?? 0 + rowDues dash
        C({ customerCode: null as unknown as string, legalName: null as unknown as string, addressCity: null, salesExecutiveName: null, segment: null, status: null as unknown as string, customerType: null as unknown as string, collectionDues: 50 }),
      ],
      "Active",
    );
    expect(o.metaLine).toContain("3 customers");
    expect(JSON.stringify(o.body[0])).toContain("unknown-type"); // unknown type passes through
    expect(JSON.stringify(o.foot)).toContain("150.00 Dr"); // total dues (100 + 0 + 50)
  });
});
