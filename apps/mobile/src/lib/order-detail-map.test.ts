import { describe, expect, it } from "vitest";
import { mapServerOrder, type ServerOrder } from "./order-detail-map";

function server(over: Partial<ServerOrder> = {}): ServerOrder {
  return {
    orderCode: "ORD-1",
    orderDate: "2026-08-05T00:00:00.000Z",
    orderStatus: "placed",
    totalLitres: "52",
    items: [
      { productName: "Engine Oil", quantityUnits: "4", packSizeLitres: "1", totalLitres: "4", segment: "Car" },
    ],
    ...over,
  };
}

describe("mapServerOrder", () => {
  it("maps header fields and trims the order date to yyyy-mm-dd", () => {
    const out = mapServerOrder(server());
    expect(out.orderCode).toBe("ORD-1");
    expect(out.orderDate).toBe("2026-08-05");
    expect(out.orderStatus).toBe("placed");
    expect(out.totalLitres).toBe(52);
  });

  it("coerces numeric strings and non-finite values (null/undefined) to numbers", () => {
    const out = mapServerOrder(
      server({
        totalLitres: null,
        items: [
          { productName: null, quantityUnits: "abc", packSizeLitres: null, totalLitres: null, segment: null },
        ],
      }),
    );
    expect(out.totalLitres).toBe(0);
    expect(out.items[0]).toEqual({
      name: "Item",
      kind: "oil",
      quantityUnits: 0, // "abc" → NaN → 0
      packSizeLitres: null, // null stays null (not 0)
      totalLitres: null,
      segment: null,
    });
  });

  it("keeps real pack/total litres when present", () => {
    const out = mapServerOrder(server());
    expect(out.items[0]).toMatchObject({ packSizeLitres: 1, totalLitres: 4, segment: "Car" });
  });

  it("defaults a missing items array to empty", () => {
    const out = mapServerOrder(server({ items: undefined as unknown as ServerOrder["items"] }));
    expect(out.items).toEqual([]);
  });

  it("maps a null order date to null", () => {
    const out = mapServerOrder(server({ orderDate: null as unknown as string }));
    expect(out.orderDate).toBeNull();
  });

  it("maps null header code/status to null", () => {
    const out = mapServerOrder(
      server({
        orderCode: null as unknown as string,
        orderStatus: null as unknown as string,
      }),
    );
    expect(out.orderCode).toBeNull();
    expect(out.orderStatus).toBeNull();
  });
});
