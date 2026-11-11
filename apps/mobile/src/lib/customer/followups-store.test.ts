import { describe, expect, test } from "vitest";
import { createTestDb } from "../../test/node-sqlite-db";
import { migrateLocalDb } from "../local-db";
import { getOpenFollowup, recordFollowup, resolveFollowupLocal } from "./followups-store";

function freshDb() {
  const db = createTestDb();
  migrateLocalDb(db);
  return db;
}

describe("customer follow-ups (local mirror)", () => {
  test("records an open follow-up and reads it back", () => {
    const db = freshDb();
    recordFollowup(
      db,
      { customerId: "c1", reason: "next week payment", followUpAt: "2026-10-20T04:30:00.000Z" },
      1000,
    );
    expect(getOpenFollowup(db, "c1")).toMatchObject({
      reason: "next week payment",
      followUpAt: "2026-10-20T04:30:00.000Z",
    });
  });

  test("a no-date follow-up is context-only (followUpAt null)", () => {
    const db = freshDb();
    recordFollowup(db, { customerId: "c1", reason: "shop closed today", followUpAt: null }, 1000);
    expect(getOpenFollowup(db, "c1")).toMatchObject({ reason: "shop closed today", followUpAt: null });
  });

  test("a newer follow-up supersedes the prior open one (<=1 open per customer)", () => {
    const db = freshDb();
    recordFollowup(db, { customerId: "c1", reason: "first", followUpAt: null }, 1000);
    recordFollowup(db, { customerId: "c1", reason: "second", followUpAt: null }, 2000);
    expect(getOpenFollowup(db, "c1")?.reason).toBe("second");
    expect(
      db.all("select 1 from customer_followups where customer_id = 'c1' and status = 'open'"),
    ).toHaveLength(1);
  });

  test("resolve marks the open one done; getOpen then returns null", () => {
    const db = freshDb();
    recordFollowup(db, { customerId: "c1", reason: "pay evening", followUpAt: null }, 1000);
    expect(resolveFollowupLocal(db, "c1")).toBe(true);
    expect(getOpenFollowup(db, "c1")).toBeNull();
    expect(resolveFollowupLocal(db, "c1")).toBe(false); // nothing open now
  });

  test("follow-ups are scoped per customer", () => {
    const db = freshDb();
    recordFollowup(db, { customerId: "c1", reason: "A", followUpAt: null }, 1000);
    recordFollowup(db, { customerId: "c2", reason: "B", followUpAt: null }, 1000);
    expect(getOpenFollowup(db, "c1")?.reason).toBe("A");
    expect(getOpenFollowup(db, "c2")?.reason).toBe("B");
  });
});
