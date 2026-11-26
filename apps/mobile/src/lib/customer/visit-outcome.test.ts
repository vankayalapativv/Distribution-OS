import { describe, expect, test } from "vitest";
import { freshDb } from "../sync-core.test-support";
import { localVisitHasOutcome } from "./visit-outcome";

const CUST = "cust-1";
const DAY = "2026-11-27";

describe("localVisitHasOutcome", () => {
  test("true when the customer has an order on the visit day", () => {
    const db = freshDb();
    db.run("insert into orders (client_uuid, customer_id, order_date, created_at) values ('o1', ?, ?, 1)", [CUST, `${DAY}T10:00:00.000Z`]);
    expect(localVisitHasOutcome(db, CUST, DAY)).toBe(true);
  });

  test("true when there's no order but a collection on the visit day", () => {
    const db = freshDb();
    db.run(
      "insert into collections (client_uuid, customer_id, collection_date, payment_mode, collection_amount, created_at) values ('c1', ?, ?, 'cash', 100, 1)",
      [CUST, `${DAY}T12:00:00.000Z`],
    );
    expect(localVisitHasOutcome(db, CUST, DAY)).toBe(true);
  });

  test("false when the day has neither an order nor a collection", () => {
    const db = freshDb();
    // Different-day order must not count.
    db.run("insert into orders (client_uuid, customer_id, order_date, created_at) values ('o2', ?, '2026-11-26T10:00:00.000Z', 1)", [CUST]);
    expect(localVisitHasOutcome(db, CUST, DAY)).toBe(false);
  });
});
