import { describe, expect, it } from "vitest";
import { cacheKeys } from "./cache-keys";

describe("cacheKeys", () => {
  it("exposes the stable list/self keys", () => {
    expect(cacheKeys.customersList).toBe("customers:list");
    expect(cacheKeys.duesSummary).toBe("dues:summary");
    expect(cacheKeys.orderOils).toBe("order:oils");
    expect(cacheKeys.deliverableInvoices).toBe("deliverable-invoices");
  });

  it("builds per-bucket and per-customer keys", () => {
    expect(cacheKeys.duesBucket("2")).toBe("dues:bucket:2");
    expect(cacheKeys.customerHeader("c1")).toBe("customer:header:c1");
    expect(cacheKeys.customerCredit("c1")).toBe("customer:credit:c1");
    expect(cacheKeys.customerOrders("c1")).toBe("customer:orders:c1");
    expect(cacheKeys.customerCollections("c1")).toBe("customer:collections:c1");
    expect(cacheKeys.ledger("c1")).toBe("ledger:c1");
    expect(cacheKeys.notes("c1")).toBe("notes:c1");
    expect(cacheKeys.photos("c1")).toBe("photos:c1");
  });
});
