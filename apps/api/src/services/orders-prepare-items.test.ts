import { describe, expect, it } from "vitest";
import { prepareOrderItems } from "./orders";

/**
 * Regression guard for the oil-litre performance invariant: a quantity-unit
 * product's order line must carry NO litres (pack + total both null), so it can
 * never inflate the per-segment oil litre actuals (which sum `total_litres`).
 */

// Minimal tagged-template stub standing in for the Neon sql client. Only the
// product lookup is exercised.
function fakeSql(products: { id: string; brand: string | null; unit: string }[]) {
  return (async (strings: TemplateStringsArray) => {
    const q = strings.join(" ");
    if (q.includes("get_products_for_order")) return products;
    return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const catalogue = [
  { id: "lit", brand: "Fuchs", unit: "litres" },
  { id: "qty", brand: "Texspin", unit: "quantity" },
];

describe("prepareOrderItems — quantity products carry no litres", () => {
  it("gives a quantity product null pack + null total (no litre contribution)", async () => {
    const r = await prepareOrderItems(fakeSql(catalogue), [
      { productId: "qty", quantityUnits: 3, segment: "Car" },
    ]);
    expect(r.enrichedItems).toHaveLength(1);
    expect(r.enrichedItems[0]).toMatchObject({
      productId: "qty",
      quantityUnits: 3,
      packSizeLitres: null,
      totalLitres: null,
      segment: "Car",
    });
    // The order's litre total excludes the quantity line entirely.
    expect(r.totalLitres).toBe(0);
  });

  it("a litres product still computes qty × pack", async () => {
    const r = await prepareOrderItems(fakeSql(catalogue), [
      { productId: "lit", quantityUnits: 2, packSizeLitres: 5, segment: "Car" },
    ]);
    expect(r.enrichedItems[0]).toMatchObject({ packSizeLitres: 5, totalLitres: 10 });
    expect(r.totalLitres).toBe(10);
  });

  it("a mixed order counts only the litres line toward total litres", async () => {
    const r = await prepareOrderItems(fakeSql(catalogue), [
      { productId: "lit", quantityUnits: 2, packSizeLitres: 5, segment: "Car" },
      { productId: "qty", quantityUnits: 4, segment: "Commercial" },
    ]);
    expect(r.totalLitres).toBe(10);
  });

  it("rejects a litres product with no pack size", async () => {
    await expect(
      prepareOrderItems(fakeSql(catalogue), [{ productId: "lit", quantityUnits: 1 }]),
    ).rejects.toThrow();
  });
});
