import { describe, expect, it } from "vitest";
import { recomputeFulfillmentForInvoice, recomputeFulfillmentForSalesReturn } from "./fulfillment";
import { makeSql, calledTag } from "../test/sql-mock";

describe("fulfillment recompute helpers", () => {
  it("recomputes the invoice's order (and no-ops when the invoice has no order)", async () => {
    const withOrder = makeSql({ fulfillment_order_for_invoice: [{ orderId: "o1" }], recompute_orders_fulfillment: [] });
    await recomputeFulfillmentForInvoice(withOrder, "inv-1");
    expect(calledTag(withOrder, "recompute_orders_fulfillment")).toBe(true);

    const noOrder = makeSql({ fulfillment_order_for_invoice: [] });
    await recomputeFulfillmentForInvoice(noOrder, "inv-2");
    expect(calledTag(noOrder, "recompute_orders_fulfillment")).toBe(false);
  });

  it("recomputes every order touched by a sales return", async () => {
    const sql = makeSql({ fulfillment_orders_for_sales_return: [{ orderId: "o1" }], recompute_orders_fulfillment: [] });
    await recomputeFulfillmentForSalesReturn(sql, "ret-1");
    expect(calledTag(sql, "recompute_orders_fulfillment")).toBe(true);
  });
});
