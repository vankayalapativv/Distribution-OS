import { afterEach, describe, expect, it, vi } from "vitest";

const { sendExpoPush } = vi.hoisted(() => ({ sendExpoPush: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./invoices", () => ({ sendExpoPush }));

import { inr, notifyAdmins } from "./admin-notify";
import { makeSql } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());

describe("admin-notify", () => {
  it("inr formats whole rupees with Indian grouping", () => {
    expect(inr(1234567)).toBe("₹12,34,567");
  });
  it("notifyAdmins inserts feed rows + pushes when tokens exist", async () => {
    const sql = makeSql({
      admin_notify_recipients: [{ id: "a1" }],
      admin_notify_tokens: [{ token: "tokA" }],
    });
    await notifyAdmins(sql, { type: "x", title: "T", body: "B", customerId: null });
    expect(sendExpoPush).toHaveBeenCalledOnce();
  });
  it("notifyAdmins no-ops when there are no admins", async () => {
    await notifyAdmins(makeSql({ admin_notify_recipients: [] }), { type: "x", title: "T", body: "B" } as never);
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});

import { notifyAdminsOfDayEvent } from "./admin-notify";

describe("notifyAdminsOfDayEvent", () => {
  it("builds a body per kind and notifies (no admins → quiet)", async () => {
    const mk = () => makeSql({ day_event_se_name: [{ name: "Asha" }], admin_notify_recipients: [] });
    await expect(notifyAdminsOfDayEvent(mk(), { seUserId: "se-1", kind: "start", at: "2026-06-01T09:00:00Z" })).resolves.toBeUndefined();
    await expect(notifyAdminsOfDayEvent(mk(), { seUserId: "se-1", kind: "manual_end", at: null })).resolves.toBeUndefined();
    await expect(notifyAdminsOfDayEvent(mk(), { seUserId: "se-1", kind: "auto_end", at: null })).resolves.toBeUndefined();
  });
});
