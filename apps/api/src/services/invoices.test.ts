import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupOldNotifications,
  clearNotifications,
  deleteNotification,
  getInvoice,
  listInvoices,
  listMyNotifications,
  markNotificationRead,
  registerPushToken,
  sendExpoPush,
} from "./invoices";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "se-1" };
const INV_ROW = {
  id: "inv-1",
  invoiceNumber: "INV-1",
  invoiceDate: new Date("2026-06-01T00:00:00Z"),
  customerId: "c1",
  customerName: "Ravi Motors",
  customerCity: "Hyderabad",
  orderId: null,
  orderCode: null,
  salesExecutiveId: "se-1",
  salesExecutiveName: "Asha",
  station: "Hyd",
  partyPhone: "999",
  totalLitres: "100",
  taxableValue: "1000",
  gstAmount: "180",
  grandTotal: "1180",
  amountCollected: "0",
  outstandingAmount: "1180",
  paymentStatus: "unpaid",
  invoiceSource: "generated",
  docStatus: "final",
  createdAt: new Date("2026-06-01T00:00:00Z"),
};

describe("listInvoices", () => {
  it("maps invoices and reads the windowed total off the first row", async () => {
    const sql = makeSql({ list_invoices: [{ ...INV_ROW, total: 1 }] });
    const res = await listInvoices(sql, { q: "ravi", customerId: null, page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.invoices[0]).toMatchObject({ id: "inv-1", invoiceDate: "2026-06-01", grandTotal: 1180, docStatus: "final" });
    const call = sql.calls.find((c) => c.tag === "list_invoices")!;
    expect(call.params[0]).toBe("%ravi%"); // like built from q
  });

  it("returns total 0 when there are no rows", async () => {
    const sql = makeSql({ list_invoices: [] });
    expect(await listInvoices(sql, { q: null, customerId: "c1", page: 2, pageSize: 10 })).toEqual({ invoices: [], total: 0 });
  });
});

describe("getInvoice", () => {
  it("returns the invoice with its line items", async () => {
    const sql = makeSql({ get_invoice: [{ ...INV_ROW, lineItems: [{ kind: "oil" }] }] });
    const inv = await getInvoice(sql, "inv-1");
    expect(inv).toMatchObject({ id: "inv-1", lineItems: [{ kind: "oil" }] });
  });

  it("defaults lineItems to [] and 404s when missing", async () => {
    // amountCollected null exercises num()'s non-string/non-number fallback (→0).
    const withNull = makeSql({ get_invoice: [{ ...INV_ROW, lineItems: null, amountCollected: null }] });
    const inv = await getInvoice(withNull, "inv-1");
    expect(inv.lineItems).toEqual([]);
    expect(inv.amountCollected).toBe(0);
    await expect(getInvoice(makeSql({ get_invoice: [] }), "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("notifications feed", () => {
  it("lists the SE's notifications newest-first (mapped)", async () => {
    const sql = makeSql({
      list_my_notifications: [
        { id: "n1", type: "invoice", title: "New invoice", body: "₹1,180", invoiceId: "inv-1", customerId: "c1", createdAt: new Date(), readAt: null },
      ],
    });
    const list = await listMyNotifications(sql, CTX);
    expect(list[0]).toMatchObject({ id: "n1", type: "invoice", invoiceId: "inv-1", readAt: null });
  });

  it("marks one read (404 when not the SE's)", async () => {
    expect(await markNotificationRead(makeSql({ mark_notification_read: [{ id: "n1" }] }), CTX, "n1")).toEqual({ id: "n1" });
    await expect(markNotificationRead(makeSql({ mark_notification_read: [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("deletes one (404 when not the SE's)", async () => {
    expect(await deleteNotification(makeSql({ delete_notification: [{ id: "n1" }] }), CTX, "n1")).toEqual({ id: "n1" });
    await expect(deleteNotification(makeSql({ delete_notification: [] }), CTX, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("clears the whole feed and reports the count", async () => {
    const sql = makeSql({ clear_notifications: [{ id: "n1" }, { id: "n2" }] });
    expect(await clearNotifications(sql, CTX)).toEqual({ deleted: 2 });
  });
});

describe("cleanupOldNotifications", () => {
  it("deletes when the 6-day gate opens, else skips", async () => {
    const ran = makeSql({ notifications_cleanup_gate: [{ key: "k" }], cleanup_old_notifications: [{ id: "n1" }] });
    expect(await cleanupOldNotifications(ran)).toEqual({ deleted: 1 });
    const skip = makeSql({ notifications_cleanup_gate: [] });
    expect(await cleanupOldNotifications(skip)).toEqual({ deleted: 0 });
  });
});

describe("registerPushToken", () => {
  it("upserts the device token", async () => {
    const sql = makeSql();
    expect(await registerPushToken(sql, CTX, "ExponentPushToken[x]", "android")).toEqual({ registered: true });
    expect(calledTag(sql, "upsert_push_token")).toBe(true);
  });
});

describe("sendExpoPush", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does nothing when there are no tokens", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await sendExpoPush([], "t", "b", {});
    expect(spy).not.toHaveBeenCalled();
  });

  it("POSTs the Expo push batch and swallows a network error", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await sendExpoPush(["tokA", "tokB"], "Title", "Body", { invoiceId: "inv-1" });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(init.body as string)).toHaveLength(2);

    spy.mockRejectedValue(new Error("offline"));
    await expect(sendExpoPush(["tokA"], "t", "b", {})).resolves.toBeUndefined();
  });
});
