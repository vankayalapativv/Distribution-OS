import { afterEach, describe, expect, it, vi } from "vitest";

const { recomputeFulfillmentForInvoice } = vi.hoisted(() => ({ recomputeFulfillmentForInvoice: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./fulfillment", () => ({ recomputeFulfillmentForInvoice }));

import { addStop, deliverableInvoices, uploadDeliveryPhoto } from "./deliveries";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "log-1" };
const runActive = { get_run_for_owner: [{ id: "r1", logisticsUserId: "log-1", status: "active" }] };
const cust = { check_stop_customer: [{ id: "c1" }] };
const file = (over = {}) => ({ type: "image/jpeg", size: 100, arrayBuffer: async () => new ArrayBuffer(4), ...over }) as unknown as File;

afterEach(() => vi.clearAllMocks());

describe("addStop — invoice validation", () => {
  const stopInput = (over = {}) => ({ customerId: "c1", latitude: null, longitude: null, clientUuid: null, invoiceId: "inv1", ...over });
  const inv = (o: Record<string, unknown>) => ({ ...runActive, ...cust, check_stop_invoice: [{ id: "inv1", sameCustomer: true, orderLinked: true, delivered: false, ...o }] });

  it("422s invoice not-found / different-customer / not-order-linked; 409s already-delivered", async () => {
    await expect(addStop(makeSql({ ...runActive, ...cust, check_stop_invoice: [] }), CTX, "r1", stopInput())).rejects.toMatchObject({ status: 422 });
    await expect(addStop(makeSql(inv({ sameCustomer: false })), CTX, "r1", stopInput())).rejects.toMatchObject({ status: 422 });
    await expect(addStop(makeSql(inv({ orderLinked: false })), CTX, "r1", stopInput())).rejects.toMatchObject({ status: 422 });
    await expect(addStop(makeSql(inv({ delivered: true })), CTX, "r1", stopInput())).rejects.toMatchObject({ status: 409 });
  });

  it("records the stop and builds the SE delivery push (and null when no SE)", async () => {
    const withSe = makeSql({
      ...runActive, ...cust, check_stop_invoice: [{ id: "inv1", sameCustomer: true, orderLinked: true, delivered: false }],
      create_delivery_stop: [{ id: "st1", runId: "r1", customerId: "c1", createdAt: "t" }],
      delivery_notify_target: [{ seId: "se-1", invoiceNumber: "INV-1", customerName: "Ravi" }],
      delivery_push_tokens: [{ token: "tokA" }],
    });
    const res = await addStop(withSe, CTX, "r1", stopInput());
    expect(res.push?.tokens).toEqual(["tokA"]);
    expect(recomputeFulfillmentForInvoice).toHaveBeenCalledWith(withSe, "inv1");

    const noSe = makeSql({
      ...runActive, ...cust, check_stop_invoice: [{ id: "inv1", sameCustomer: true, orderLinked: true, delivered: false }],
      create_delivery_stop: [{ id: "st2", runId: "r1", customerId: "c1", createdAt: "t" }],
      delivery_notify_target: [{ seId: null }],
    });
    expect((await addStop(noSe, CTX, "r1", stopInput())).push).toBeNull();
  });
});

describe("deliverableInvoices", () => {
  it("maps invoices (null field → '' via str)", async () => {
    const sql = makeSql({ deliverable_invoices: [{ id: "inv1", invoiceNumber: null, invoiceDate: "2026-06-01", grandTotal: "1180", customerId: "c1", customerName: "Ravi", customerCode: "C1", addressStreet: "Rd", addressCity: "Hyd", latitude: "17.4", longitude: "78.4", orderCode: "ORD-1" }] });
    const rows = await deliverableInvoices(sql, "c1");
    expect(rows[0]).toMatchObject({ id: "inv1", invoiceNumber: "", orderCode: "ORD-1" });
  });
});

describe("uploadDeliveryPhoto", () => {
  it("422s an empty/oversize file", async () => {
    const bucket = { put: vi.fn() } as never;
    await expect(uploadDeliveryPhoto(makeSql(), bucket, CTX, "r1", { kind: "delivery", stopId: null, file: file({ size: 0 }) })).rejects.toMatchObject({ status: 422 });
  });
});
