import { describe, expect, it } from "vitest";
import { itemOriginal } from "./order-detail-item-helpers";
import type { OrderItem } from "./orders-api";

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1", productId: "p1", productName: "Oil",     brand: null,
    quantityUnits: 8, packSizeLitres: 5, totalLitres: 40, segment: null, hsnCode: null,
    ...over,
  };
}

describe("itemOriginal", () => {
  it("adds the cancelled remainder back onto the live quantity and litres", () => {
    expect(itemOriginal(item(), 2)).toEqual({ originalQty: 10, originalLitres: 50 });
  });

  it("leaves litres null when the line has none", () => {
    expect(itemOriginal(item({ totalLitres: null }), 2)).toEqual({ originalQty: 10, originalLitres: null });
  });

  it("treats a missing pack size as zero litres per unit", () => {
    expect(itemOriginal(item({ packSizeLitres: null, totalLitres: 40 }), 3)).toEqual({
      originalQty: 11,
      originalLitres: 40,
    });
  });
});
