import { describe, expect, it } from "vitest";
import { checkinBody, collectionBody, orderBody } from "./notify-format";

describe("context-aware notification bodies", () => {
  describe("checkinBody", () => {
    it("leads with the executive and names the shop", () => {
      expect(checkinBody("Sandeep", "Ravi Motors")).toBe("Sandeep · Ravi Motors");
    });
    it("names the executive even without a customer", () => {
      expect(checkinBody("Sandeep", null)).toBe("Sandeep checked in a customer");
    });
    it("falls back to the old wording when the executive is unknown", () => {
      expect(checkinBody(null, "Ravi Motors")).toBe("Ravi Motors checked in");
      expect(checkinBody(null, null)).toBe("A customer was checked in");
    });
  });

  describe("orderBody", () => {
    it("leads with the executive, then order code, then shop", () => {
      expect(orderBody("Sandeep", "ORD-123", "Ravi Motors")).toBe("Sandeep · ORD-123 · Ravi Motors");
    });
    it("drops the shop when unknown but keeps executive + code", () => {
      expect(orderBody("Sandeep", "ORD-123", null)).toBe("Sandeep · ORD-123");
    });
    it("falls back to code + shop, then bare code, without an executive", () => {
      expect(orderBody(null, "ORD-123", "Ravi Motors")).toBe("ORD-123 · Ravi Motors");
      expect(orderBody(null, "ORD-123", null)).toBe("New order ORD-123");
    });
  });

  describe("collectionBody", () => {
    it("leads with the executive, then amount from shop", () => {
      expect(collectionBody("Sandeep", "₹5,000", "Ravi Motors")).toBe("Sandeep · ₹5,000 from Ravi Motors");
    });
    it("keeps the executive + amount without a customer", () => {
      expect(collectionBody("Sandeep", "₹5,000", null)).toBe("Sandeep · ₹5,000 collected");
    });
    it("falls back to amount-only wording without an executive", () => {
      expect(collectionBody(null, "₹5,000", "Ravi Motors")).toBe("₹5,000 from Ravi Motors");
      expect(collectionBody(null, "₹5,000", null)).toBe("₹5,000 collected");
    });
  });
});
