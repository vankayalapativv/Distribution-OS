import { describe, expect, it } from "vitest";
import { allocateOldestFirst, capAndSpillExplicit, type InvoiceTarget } from "./opening-balance-fifo";

const inv = (id: string, outstanding: number, dueDate: string, createdAt = `${dueDate}T00:00:00Z`): InvoiceTarget => ({
  id,
  outstanding,
  dueDate,
  createdAt,
});

describe("allocateOldestFirst — no opening balance (present behaviour is unchanged)", () => {
  it("pays the oldest invoice first, then the next", () => {
    const r = allocateOldestFirst(1500, null, [
      inv("b", 1000, "2026-07-10"),
      inv("a", 1000, "2026-06-01"),
    ]);
    expect(r.allocations).toEqual([
      { kind: "invoice", id: "a", amount: 1000 },
      { kind: "invoice", id: "b", amount: 500 },
    ]);
    expect(r.leftover).toBe(0);
  });

  it("finishes a partially-paid oldest invoice before moving on", () => {
    // 'a' already partly paid → 300 left; payment clears it then hits 'b'.
    const r = allocateOldestFirst(800, null, [
      inv("a", 300, "2026-06-01"),
      inv("b", 1000, "2026-06-15"),
    ]);
    expect(r.allocations).toEqual([
      { kind: "invoice", id: "a", amount: 300 },
      { kind: "invoice", id: "b", amount: 500 },
    ]);
  });

  it("breaks a due-date tie by createdAt", () => {
    const r = allocateOldestFirst(600, null, [
      inv("late", 500, "2026-06-01", "2026-06-01T12:00:00Z"),
      inv("early", 500, "2026-06-01", "2026-06-01T09:00:00Z"),
    ]);
    expect(r.allocations.map((a) => a.id)).toEqual(["early", "late"]);
  });

  it("over-payment leaves held credit (leftover)", () => {
    const r = allocateOldestFirst(1200, null, [inv("a", 1000, "2026-06-01")]);
    expect(r.allocations).toEqual([{ kind: "invoice", id: "a", amount: 1000 }]);
    expect(r.leftover).toBe(200);
  });
});

describe("allocateOldestFirst — opening balance is paid FIRST", () => {
  const invoices = [inv("a", 1000, "2026-06-01"), inv("b", 1000, "2026-06-15")];

  it("reduces the opening balance before any invoice", () => {
    const r = allocateOldestFirst(700, { id: "ob", outstanding: 5000 }, invoices);
    expect(r.allocations).toEqual([{ kind: "opening", id: "ob", amount: 700 }]);
    expect(r.leftover).toBe(0);
  });

  it("clears the opening balance, then spills into the oldest invoice", () => {
    const r = allocateOldestFirst(1200, { id: "ob", outstanding: 800 }, invoices);
    expect(r.allocations).toEqual([
      { kind: "opening", id: "ob", amount: 800 },
      { kind: "invoice", id: "a", amount: 400 },
    ]);
  });

  it("opening → oldest invoice → next invoice, in order", () => {
    const r = allocateOldestFirst(2500, { id: "ob", outstanding: 800 }, invoices);
    expect(r.allocations).toEqual([
      { kind: "opening", id: "ob", amount: 800 },
      { kind: "invoice", id: "a", amount: 1000 },
      { kind: "invoice", id: "b", amount: 700 },
    ]);
    expect(r.leftover).toBe(0);
  });

  it("opening is first even when an invoice's date is older than the opening's context", () => {
    // Allocation order does not depend on the opening's as-of date — it is always
    // the first debt cleared (matches the agreed spec).
    const r = allocateOldestFirst(500, { id: "ob", outstanding: 500 }, [
      inv("older-invoice", 1000, "2020-01-01"),
    ]);
    expect(r.allocations).toEqual([{ kind: "opening", id: "ob", amount: 500 }]);
  });

  it("a fully-paid opening balance (outstanding 0) behaves like no opening", () => {
    const r = allocateOldestFirst(600, { id: "ob", outstanding: 0 }, invoices);
    expect(r.allocations).toEqual([{ kind: "invoice", id: "a", amount: 600 }]);
  });

  it("clears opening + all invoices and returns the rest as held credit", () => {
    const r = allocateOldestFirst(5000, { id: "ob", outstanding: 800 }, invoices);
    expect(r.allocations).toEqual([
      { kind: "opening", id: "ob", amount: 800 },
      { kind: "invoice", id: "a", amount: 1000 },
      { kind: "invoice", id: "b", amount: 1000 },
    ]);
    expect(r.leftover).toBe(2200);
  });
});

describe("allocateOldestFirst — money precision + guards", () => {
  it("keeps 2-decimal amounts free of float drift", () => {
    const r = allocateOldestFirst(0.3, { id: "ob", outstanding: 0.1 }, [inv("a", 0.2, "2026-06-01")]);
    expect(r.allocations).toEqual([
      { kind: "opening", id: "ob", amount: 0.1 },
      { kind: "invoice", id: "a", amount: 0.2 },
    ]);
    expect(r.leftover).toBe(0);
  });

  it("a zero (or negative) amount allocates nothing", () => {
    expect(allocateOldestFirst(0, { id: "ob", outstanding: 500 }, [inv("a", 100, "2026-06-01")])).toEqual({
      allocations: [],
      leftover: 0,
    });
  });

  it("does not mutate the caller's invoice array", () => {
    const invoices = [inv("b", 1000, "2026-07-10"), inv("a", 1000, "2026-06-01")];
    const before = invoices.map((i) => i.id);
    allocateOldestFirst(500, null, invoices);
    expect(invoices.map((i) => i.id)).toEqual(before);
  });
});

describe("capAndSpillExplicit — explicit allocations never over-fill an invoice", () => {
  it("caps at the invoice's outstanding and spills the rest (the ₹1,960 credit-note case)", () => {
    // BAL/26-27/0132 had ₹1,950 left; the ₹1,960 credit note was recorded
    // against it. It must fit 1,950 and spill ₹10.
    const r = capAndSpillExplicit([{ invoiceId: "0132", requested: 1960, outstanding: 1950 }]);
    expect(r.capped).toEqual([{ invoiceId: "0132", applied: 1950, row: "shrink" }]);
    expect(r.excess).toBe(10);
  });

  it("leaves a fitting allocation unchanged with no excess", () => {
    const r = capAndSpillExplicit([{ invoiceId: "a", requested: 500, outstanding: 800 }]);
    expect(r.capped).toEqual([{ invoiceId: "a", applied: 500, row: "unchanged" }]);
    expect(r.excess).toBe(0);
  });

  it("marks a row for deletion when the target is already settled (spills the whole amount)", () => {
    const r = capAndSpillExplicit([{ invoiceId: "paid", requested: 300, outstanding: 0 }]);
    expect(r.capped).toEqual([{ invoiceId: "paid", applied: 0, row: "delete" }]);
    expect(r.excess).toBe(300);
  });

  it("handles an exact fit (applied === requested === outstanding) as unchanged", () => {
    const r = capAndSpillExplicit([{ invoiceId: "a", requested: 1000, outstanding: 1000 }]);
    expect(r.capped).toEqual([{ invoiceId: "a", applied: 1000, row: "unchanged" }]);
    expect(r.excess).toBe(0);
  });

  it("sums excess across several explicit targets and keeps paise exact", () => {
    const r = capAndSpillExplicit([
      { invoiceId: "a", requested: 100.55, outstanding: 100 }, // spill 0.55
      { invoiceId: "b", requested: 50, outstanding: 200 }, //     spill 0
      { invoiceId: "c", requested: 75.1, outstanding: 75 }, //    spill 0.10
    ]);
    expect(r.capped).toEqual([
      { invoiceId: "a", applied: 100, row: "shrink" },
      { invoiceId: "b", applied: 50, row: "unchanged" },
      { invoiceId: "c", applied: 75, row: "shrink" },
    ]);
    expect(r.excess).toBe(0.65);
  });

  it("clamps a negative/garbage outstanding to zero (drops the row, spills all)", () => {
    const r = capAndSpillExplicit([{ invoiceId: "x", requested: 200, outstanding: -5 }]);
    expect(r.capped).toEqual([{ invoiceId: "x", applied: 0, row: "delete" }]);
    expect(r.excess).toBe(200);
  });
});
