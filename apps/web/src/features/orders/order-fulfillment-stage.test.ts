import { describe, expect, it } from "vitest";
import { deriveStage, STAGE_STYLES } from "./order-fulfillment-stage";
import type { Shipment, SkuProgress } from "./orders-api";

function ship(over: Partial<Shipment> = {}): Shipment {
  return {
    id: "s1", code: "INV-1", date: "2026-08-01", total: 0, outstanding: 0,
    oilLitres: 0, invoicedAt: "2026-08-01T00:00:00Z", cancelled: false, delivered: false, deliveredAt: null,
    ...over,
  };
}
function sku(over: Partial<SkuProgress> = {}): SkuProgress {
  return {
    orderItemId: "i1", label: "Oil", packSizeLitres: 1,
    orderedUnits: 10, cancelledUnits: 0, invoicedUnits: 10, remainingUnits: 0, returnedUnits: 0,
    ...over,
  };
}

describe("deriveStage", () => {
  it("short-close takes precedence over everything", () => {
    expect(deriveStage([ship({ delivered: true })], [sku({ cancelledUnits: 2 })])).toBe("partially_cancelled");
  });

  it("fully returned when all billed units came back", () => {
    expect(deriveStage([ship()], [sku({ invoicedUnits: 5, returnedUnits: 5 })])).toBe("returned");
  });

  it("partially returned when only some billed units came back", () => {
    expect(deriveStage([ship()], [sku({ invoicedUnits: 5, returnedUnits: 2 })])).toBe("partially_returned");
  });

  it("treats a row missing returnedUnits as zero returned within the return branch", () => {
    const rows = [
      sku({ orderItemId: "i1", invoicedUnits: 4, returnedUnits: 4 }),
      { orderItemId: "i2", label: "B", packSizeLitres: 1, orderedUnits: 3, cancelledUnits: 0, invoicedUnits: 3, remainingUnits: 0 } as unknown as SkuProgress,
    ];
    // Row i2 has billed units still unreturned → partially returned.
    expect(deriveStage([ship()], rows)).toBe("partially_returned");
  });

  it("ordered when there are no shipments", () => {
    expect(deriveStage([], [sku({ invoicedUnits: 0, remainingUnits: 10 })])).toBe("ordered");
  });

  it("delivered when every shipment is delivered and nothing remains", () => {
    expect(deriveStage([ship({ delivered: true })], [sku()])).toBe("delivered");
  });

  it("partially delivered when some (not all) is delivered", () => {
    expect(deriveStage([ship({ delivered: true }), ship({ id: "s2", delivered: false })], [sku()])).toBe(
      "partially_delivered",
    );
  });

  it("partially invoiced when billed but SKUs still remain and nothing delivered", () => {
    expect(deriveStage([ship()], [sku({ invoicedUnits: 6, remainingUnits: 4 })])).toBe("partially_invoiced");
  });

  it("invoiced when fully billed, undelivered, nothing remaining", () => {
    expect(deriveStage([ship()], [sku()])).toBe("invoiced");
  });

  it("has a style for every stage", () => {
    expect(Object.keys(STAGE_STYLES)).toContain("partially_cancelled");
    expect(STAGE_STYLES.delivered.label).toBe("Delivered");
  });
});
