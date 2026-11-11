import { describe, expect, it } from "vitest";
import { getOilAnalytics } from "./dashboard-analytics";
import { makeSql } from "../test/sql-mock";

describe("getOilAnalytics", () => {
  it("aggregates oil litres by segment (null segment tolerated)", async () => {
    const sql = makeSql({
      analytics_oils: [
        { segment: "Car", productId: "p1", productName: "Titan", packSizeLitres: "5", litres: "10", quantity: "2", orders: "1", customers: "1" },
        { segment: null, productId: "p2", productName: null, packSizeLitres: "1", litres: "0", quantity: "0", orders: "0", customers: "0" },
      ],
    });
    const out = await getOilAnalytics(sql, { userId: "u1" } as never, { from: "2026-06-01", to: "2026-06-30" });
    expect(out).toHaveProperty("segments");
    expect(out).toHaveProperty("totalLitres");
  });
});
