import { describe, expect, it } from "vitest";
import { getBadgeCounts } from "./badges";
import { makeSql } from "../test/sql-mock";

const OFFICE = { userId: "u1", role: "SUPER_ADMIN" as const };
const SE = { userId: "se1", role: "SALES_EXECUTIVE" as const };

describe("getBadgeCounts", () => {
  it("maps every badge + latest item for an office user", async () => {
    const sql = makeSql({
      badge_counts: [
        {
          tasksActive: 3,
          ordersNew: "2",
          collectionsNew: 1,
          visitsNew: 5,
          alertsOpen: 4,
          collection: { amount: "1500", customer: "Ravi Motors", executive: "Sandeep" },
          order: { value: 70800, customer: "Sri Auto", executive: "Asha" },
          visit: { customer: "Kumar", executive: "Ravi" },
        },
      ],
    });
    const b = await getBadgeCounts(sql, OFFICE);
    expect(b).toMatchObject({ tasksActive: 3, ordersNew: 2, collectionsNew: 1, visitsNew: 5, alertsOpen: 4 });
    expect(b.latestCollection).toEqual({ amount: 1500, customer: "Ravi Motors", executive: "Sandeep" });
    expect(b.latestOrder).toEqual({ value: 70800, customer: "Sri Auto", executive: "Asha" });
    expect(b.latestVisit).toEqual({ customer: "Kumar", executive: "Ravi" });
  });

  it("returns null latest-items and null executive when absent / not an SE", async () => {
    const sql = makeSql({
      badge_counts: [
        {
          tasksActive: 0,
          ordersNew: 0,
          collectionsNew: 0,
          visitsNew: 0,
          alertsOpen: 0,
          collection: { amount: 100, customer: "X", executive: "" }, // office order with no SE
          order: null,
          visit: null,
        },
      ],
    });
    const b = await getBadgeCounts(sql, OFFICE);
    expect(b.latestCollection).toEqual({ amount: 100, customer: "X", executive: null });
    expect(b.latestOrder).toBeNull();
    expect(b.latestVisit).toBeNull();
  });

  it("handles an SE (office counts gated off) and a missing row", async () => {
    const sql = makeSql({ badge_counts: [] });
    const b = await getBadgeCounts(sql, SE);
    expect(b).toMatchObject({ tasksActive: 0, ordersNew: 0, alertsOpen: 0 });
    expect(b.latestOrder).toBeNull();
  });
});
