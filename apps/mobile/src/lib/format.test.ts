import { describe, expect, it } from "vitest";
import { compactInr, formatPaymentMode, formatStatus, packLabel } from "./format";

describe("formatPaymentMode", () => {
  it("maps known payment-mode codes to display labels", () => {
    expect(formatPaymentMode("cash")).toBe("Cash");
    expect(formatPaymentMode("cheque")).toBe("Cheque");
    expect(formatPaymentMode("upi")).toBe("UPI");
    expect(formatPaymentMode("neft_rtgs")).toBe("NEFT/RTGS");
  });
  it("capitalizes an unknown code", () => {
    expect(formatPaymentMode("wallet")).toBe("Wallet");
  });
  it("returns empty for null/undefined/empty", () => {
    expect(formatPaymentMode(null)).toBe("");
    expect(formatPaymentMode(undefined)).toBe("");
    expect(formatPaymentMode("")).toBe("");
  });
});

describe("packLabel", () => {
  it("renders sub-litre packs in millilitres", () => {
    expect(packLabel(0.5)).toBe("500 mL");
    expect(packLabel(0.25)).toBe("250 mL");
  });
  it("renders litre packs in litres", () => {
    expect(packLabel(1)).toBe("1 L");
    expect(packLabel(7.5)).toBe("7.5 L");
  });
  it("renders zero as litres (not mL)", () => {
    expect(packLabel(0)).toBe("0 L");
  });
});

describe("formatStatus", () => {
  it("capitalizes a server status", () => {
    expect(formatStatus("verified")).toBe("Verified");
  });
  it("returns empty for null/undefined", () => {
    expect(formatStatus(null)).toBe("");
    expect(formatStatus(undefined)).toBe("");
  });
});

describe("compactInr", () => {
  it("renders plain rupees under a thousand", () => {
    expect(compactInr(450)).toBe("₹450");
  });
  it("renders thousands with a k suffix (rounded, no decimal)", () => {
    expect(compactInr(8500)).toBe("₹9k");
    expect(compactInr(85000)).toBe("₹85k");
  });
  it("renders lakhs with one decimal", () => {
    expect(compactInr(1210000)).toBe("₹12.1L");
  });
  it("renders crores with one decimal below ₹100Cr", () => {
    expect(compactInr(1.2e7)).toBe("₹1.2Cr");
  });
  it("drops the decimal at or above ₹100Cr", () => {
    expect(compactInr(1.5e8)).toBe("₹15Cr");
  });
  it("floors negatives to ₹0", () => {
    expect(compactInr(-99)).toBe("₹0");
  });
});
