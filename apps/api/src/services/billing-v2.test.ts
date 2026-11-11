import { afterEach, describe, expect, it, vi } from "vitest";

const { getSystemSettings } = vi.hoisted(() => ({ getSystemSettings: vi.fn().mockResolvedValue({ company: { name: "SA", gstin: "36X" } }) }));
const { createOrder, orderIsUsable } = vi.hoisted(() => ({ createOrder: vi.fn(), orderIsUsable: vi.fn() }));
vi.mock("./system-settings", () => ({ getSystemSettings }));
vi.mock("../lib/razorpay", () => ({ createOrder, orderIsUsable }));

import { chargeAmountPaisa, computeAccess, ensureCurrentCharge, ensureOrderForCharge, getBillingAccess, getReceipt, listCharges } from "./billing-v2";
import { makeSql } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());

const CHARGE = { id: "ch1", periodStart: "2026-06-01", periodEnd: "2026-06-30", seats: "3", amountPaisa: "212400", status: "paid", razorpayOrderId: "o1", razorpayPaymentId: "p1", paidAt: "2026-06-05" };

describe("chargeAmountPaisa / computeAccess", () => {
  it("chargeAmountPaisa clamps negatives/fractions", () => {
    expect(chargeAmountPaisa(3)).toBeGreaterThan(0);
    expect(chargeAmountPaisa(-2)).toBe(0);
  });
  it("computeAccess covers no-billing, covered(free/paid), grace, expired", () => {
    expect(computeAccess({ paidThroughMs: null, currentCovered: false, currentIsFree: false, nowMs: 0 })).toMatchObject({ blocked: true, state: "none" });
    expect(computeAccess({ paidThroughMs: 1000, currentCovered: true, currentIsFree: true, nowMs: 0 })).toMatchObject({ state: "free", blocked: false });
    expect(computeAccess({ paidThroughMs: 1000, currentCovered: true, currentIsFree: false, nowMs: 0 })).toMatchObject({ state: "active" });
    const graceMs = 1000 + 5 * 86400000;
    expect(computeAccess({ paidThroughMs: 1000, currentCovered: false, currentIsFree: false, nowMs: graceMs - 1, graceDays: 5 })).toMatchObject({ state: "grace", blocked: false });
    expect(computeAccess({ paidThroughMs: 1000, currentCovered: false, currentIsFree: false, nowMs: graceMs + 1, graceDays: 5 })).toMatchObject({ state: "blocked", blocked: true });
  });
});

describe("listCharges / getReceipt", () => {
  it("maps charges (null paidAt / date coercion)", async () => {
    const rows = await listCharges(makeSql({ billing_v2_list_charges: [CHARGE, { ...CHARGE, id: "ch2", status: "pending", paidAt: null, periodStart: null }] }));
    expect(rows[0]).toMatchObject({ id: "ch1", seats: 3, status: "paid", paidAt: "2026-06-05" });
    expect(rows[1]).toMatchObject({ paidAt: null, periodStart: "" });
  });
  it("getReceipt null when unpaid, else derives GST", async () => {
    expect(await getReceipt(makeSql({ billing_v2_receipt: [] }), "ch1")).toBeNull();
    const r = await getReceipt(makeSql({ billing_v2_receipt: [CHARGE] }), "ch1");
    expect(r!.gst.cgstPaisa + r!.gst.sgstPaisa).toBe(212400 - Math.round(212400 / 1.18));
  });
});

describe("ensureCurrentCharge", () => {
  it("no-op existing / create / race", async () => {
    expect(await ensureCurrentCharge(makeSql({ billing_v2_go_live_set: [], billing_v2_current_exists: [{ id: "ch1" }] }))).toEqual({ created: false });
    expect(await ensureCurrentCharge(makeSql({ billing_v2_go_live_set: [], billing_v2_current_exists: [], billing_v2_seat_count: [{ n: 3 }], billing_v2_insert_pending: [{ id: "ch9" }] }))).toEqual({ created: true, chargeId: "ch9" });
    expect(await ensureCurrentCharge(makeSql({ billing_v2_go_live_set: [], billing_v2_current_exists: [], billing_v2_seat_count: [{ n: 3 }], billing_v2_insert_pending: [] }))).toEqual({ created: false });
  });
});

describe("getBillingAccess", () => {
  it("assembles access from the paid-through month (hits istEndOfDayMs)", async () => {
    const sql = makeSql({
      billing_v2_go_live_set: [], billing_v2_current_exists: [{ id: "ch1" }], billing_v2_sync_pending: [],
      billing_v2_access: [{ paidThrough: "2026-06-30", currentStatus: "paid", currentStart: "2026-06-01", currentEnd: "2026-06-30" }],
      billing_v2_current_charge: [CHARGE],
    });
    const out = await getBillingAccess(sql);
    expect(out.current).toMatchObject({ id: "ch1" });
    expect(out.accessUntilIso).not.toBeNull();
  });
});

describe("ensureOrderForCharge", () => {
  it("returns the stored order id for a non-pending charge", async () => {
    const sql = makeSql({ billing_v2_charge_for_order: [{ id: "ch1", status: "paid", razorpayOrderId: "o1" }] });
    expect(await ensureOrderForCharge(sql, {} as never, "ch1")).toBe("o1");
  });
  it("reuses a still-usable stored order", async () => {
    orderIsUsable.mockResolvedValue(true);
    const sql = makeSql({ billing_v2_charge_for_order: [{ id: "ch1", status: "pending", amountPaisa: "212400", razorpayOrderId: "o1" }] });
    expect(await ensureOrderForCharge(sql, {} as never, "ch1")).toBe("o1");
  });
  it("creates a fresh order when none is usable", async () => {
    orderIsUsable.mockResolvedValue(false);
    createOrder.mockResolvedValue({ id: "o-new" });
    const sql = makeSql({ billing_v2_charge_for_order: [{ id: "ch1", status: "pending", amountPaisa: "212400", periodStart: "2026-06-01", razorpayOrderId: null }], billing_v2_set_order: [] });
    expect(await ensureOrderForCharge(sql, {} as never, "ch1")).toBe("o-new");
    expect(createOrder).toHaveBeenCalled();
  });
});
