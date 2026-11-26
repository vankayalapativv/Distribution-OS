import { describe, expect, test } from "vitest";
import { createTestDb } from "../../test/node-sqlite-db";
import { migrateLocalDb, type LocalDb } from "../local-db";
import { recordFollowup } from "./followups-store";
import { listFollowupReminders, pendingFollowupCount } from "./followup-reminders";

function freshDb() {
  const db = createTestDb();
  migrateLocalDb(db);
  return db;
}

describe("followup reminders (Reminders tab)", () => {
  test("lists only open, dated follow-ups, soonest first, with names", () => {
    const db = freshDb();
    db.run("insert into customers (id, legal_name, cached_at) values ('c1', 'Cached Motors', 1)");
    // Dated, snapshot name absent → falls back to the cached customer name.
    recordFollowup(db, { customerId: "c1", reason: "later", followUpAt: "2026-12-05T09:00:00.000Z" }, 2000);
    // Dated, carries its own snapshot name → used as-is.
    recordFollowup(db, { customerId: "c2", customerName: "Snapshot Oils", reason: "soon", followUpAt: "2026-12-01T09:00:00.000Z" }, 1000);
    // Open but undated → excluded from reminders.
    recordFollowup(db, { customerId: "c3", reason: "no date", followUpAt: null }, 1500);

    const reminders = listFollowupReminders(db);
    expect(reminders.map((r) => r.customerId)).toEqual(["c2", "c1"]); // soonest first
    expect(reminders[0].customerName).toBe("Snapshot Oils");
    expect(reminders[1].customerName).toBe("Cached Motors");
  });

  test("falls back to 'Customer' when no name is known", () => {
    const db = freshDb();
    recordFollowup(db, { customerId: "c9", reason: "x", followUpAt: "2026-12-01T09:00:00.000Z" }, 1000);
    expect(listFollowupReminders(db)[0].customerName).toBe("Customer");
  });

  test("counts only open dated follow-ups", () => {
    const db = freshDb();
    expect(pendingFollowupCount(db)).toBe(0);
    recordFollowup(db, { customerId: "c1", reason: "a", followUpAt: "2026-12-01T09:00:00.000Z" }, 1000);
    recordFollowup(db, { customerId: "c2", reason: "b", followUpAt: null }, 1000); // undated → not counted
    expect(pendingFollowupCount(db)).toBe(1);
  });

  test("defaults to 0 when the count query yields no row", () => {
    const stub = { first: () => undefined } as unknown as LocalDb;
    expect(pendingFollowupCount(stub)).toBe(0);
  });
});
