import { describe, expect, it } from "vitest";
import { buildTabs, LEDGER_TAB, ORDERS_TAB, PHOTOS_TAB } from "./customer-detail-tabs";

const counts = {
  ordersTotal: 3,
  ordersLoading: false,
  visitsCount: 7,
  visitsLoading: false,
  photosCount: 2,
  photosLoading: false,
};

describe("buildTabs", () => {
  it("includes the info tab(s) plus the five feature tabs with counts", () => {
    const tabs = buildTabs(counts);
    const keys = tabs.map((t) => t.key);
    expect(keys).toContain(ORDERS_TAB);
    expect(keys).toContain(LEDGER_TAB);
    expect(keys).toContain(PHOTOS_TAB);
    expect(tabs.find((t) => t.key === ORDERS_TAB)?.count).toBe(3);
    expect(tabs.find((t) => t.key === "visits")?.count).toBe(7);
    expect(tabs.find((t) => t.key === PHOTOS_TAB)?.count).toBe(2);
    // Ledger + Notes never carry a count
    expect(tabs.find((t) => t.key === LEDGER_TAB)?.count).toBeUndefined();
  });

  it("hides the count while a tab's query is loading", () => {
    const tabs = buildTabs({ ...counts, ordersLoading: true, visitsLoading: true, photosLoading: true });
    expect(tabs.find((t) => t.key === ORDERS_TAB)?.count).toBeUndefined();
    expect(tabs.find((t) => t.key === "visits")?.count).toBeUndefined();
    expect(tabs.find((t) => t.key === PHOTOS_TAB)?.count).toBeUndefined();
  });
});
