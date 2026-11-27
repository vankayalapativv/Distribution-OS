import { describe, expect, it, vi } from "vitest";
import { buildTabConfig } from "./alerts-tab-config";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

const notif = (over: Partial<InvoiceNotification> = {}): InvoiceNotification => ({
  id: "n1",
  type: "invoice",
  title: "t",
  body: null,
  invoiceId: null,
  customerId: null,
  createdAt: "2026-11-27T09:00:00Z",
  readAt: null,
  ...over,
});

describe("buildTabConfig", () => {
  const onDues = vi.fn();
  const onOpen = vi.fn();
  const markRead = vi.fn();
  const cfg = buildTabConfig({
    dues: [notif({ id: "d1" })],
    invoices: [notif({ id: "i1" }), notif({ id: "i2" })],
    deliveries: [notif({ id: "x1" })],
    onDues,
    onOpen,
    markRead,
  });

  it("wires each tab's items, skeleton count and press handler", () => {
    expect(cfg.dues.items.map((n) => n.id)).toEqual(["d1"]);
    expect(cfg.invoice.items).toHaveLength(2);
    expect(cfg.delivery.skeletonCount).toBe(2);
    cfg.dues.onPress(notif());
    cfg.invoice.onPress(notif());
    cfg.delivery.onPress(notif());
    expect(onDues).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalled();
    expect(markRead).toHaveBeenCalled();
  });

  it("gives a dues row a chevron only when it carries a customer", () => {
    expect(cfg.dues.trailing(notif({ customerId: "c1" }))).toBeTruthy();
    expect(cfg.dues.trailing(notif({ customerId: null }))).toBeUndefined();
    expect(cfg.invoice.trailing(notif())).toBeTruthy(); // always a chevron
    expect(cfg.delivery.trailing(notif())).toBeTruthy(); // always a check
  });
});
