import { describe, expect, it } from "vitest";
import { recomputeAggregates, recomputeCustomerBalances, toPaise } from "./reconcile-recompute";
import { makeSql, calledTag } from "../test/sql-mock";

describe("recomputeAggregates (pure FIFO)", () => {
  it("applies the credit pool oldest-first across opening + invoices", () => {
    const out = recomputeAggregates({
      openingAmountPaise: toPaise(100),
      creditPoolPaise: toPaise(250),
      invoices: [
        { id: "i-late", netPaise: toPaise(100), returnedPaise: 0, dueDate: "2026-07-01", createdAt: "2026-06-02" },
        { id: "i-early", netPaise: toPaise(100), returnedPaise: toPaise(20), dueDate: "2026-06-01", createdAt: "2026-06-01" },
      ],
    });
    expect(out.openingOutstandingPaise).toBe(0); // opening (100) paid first
    const early = out.invoices.find((i) => i.id === "i-early")!;
    expect(early.paymentStatus).toBe("paid"); // 80 debt, paid before the later invoice
    expect(out.heldCreditPaise).toBeGreaterThanOrEqual(0);
  });
  it("orders equal-dated debts by id (tiebreak)", () => {
    const out = recomputeAggregates({ openingAmountPaise: 0, creditPoolPaise: toPaise(100), invoices: [
      { id: "b", netPaise: toPaise(100), returnedPaise: 0, dueDate: "2026-06-01", createdAt: "2026-06-01" },
      { id: "a", netPaise: toPaise(100), returnedPaise: 0, dueDate: "2026-06-01", createdAt: "2026-06-01" },
    ] });
    expect(out.invoices.find((i) => i.id === "a")!.paymentStatus).toBe("paid"); // "a" < "b" paid first
  });
  it("marks an invoice unpaid when the credit pool is empty", () => {
    const out = recomputeAggregates({ openingAmountPaise: 0, creditPoolPaise: 0, invoices: [{ id: "i1", netPaise: toPaise(100), returnedPaise: 0, dueDate: "2026-06-01", createdAt: "2026-06-01" }] });
    expect(out.invoices[0].paymentStatus).toBe("unpaid");
  });
});

describe("recomputeCustomerBalances", () => {
  it("reads ground truth (null coercion), applies, and writes the batch", async () => {
    const sql = makeSql({
      recompute_opening: [{ id: "ob1", openingAmount: "100" }],
      recompute_invoices: [{ id: "i1", net: "500", returned: null, dueDate: null, createdAt: "2026-06-01" }, { id: 999, net: "100", returned: "0", dueDate: 42, createdAt: new Date("2026-06-02T00:00:00Z") }],
      recompute_credit_pool: [{ pool: "300" }],
    });
    await recomputeCustomerBalances(sql, "c1");
    expect(calledTag(sql, "recompute_write_invoice")).toBe(true);
    expect(calledTag(sql, "recompute_write_opening")).toBe(true);
    expect(calledTag(sql, "recompute_zero_cancelled")).toBe(true);
  });
});
