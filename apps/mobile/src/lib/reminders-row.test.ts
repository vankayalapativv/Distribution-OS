import { describe, expect, it } from "vitest";
import { rowToReminder } from "./reminders-row";

describe("rowToReminder", () => {
  it("maps a full DB row", () => {
    expect(
      rowToReminder({
        id: 7, title: "call shop", remind_at: 123, customer_id: "c1", customer_name: "Balaji",
        notification_id: "notif-1", status: "done", created_at: 99,
      }),
    ).toEqual({
      id: 7, title: "call shop", remindAt: 123, customerId: "c1", customerName: "Balaji",
      notificationId: "notif-1", status: "done", createdAt: 99,
    });
  });

  it("applies null/pending fallbacks for missing optional columns", () => {
    const r = rowToReminder({ id: 1, title: "t", remind_at: 1, created_at: 1 });
    expect(r.customerId).toBeNull();
    expect(r.customerName).toBeNull();
    expect(r.notificationId).toBeNull();
    expect(r.status).toBe("pending");
  });
});
