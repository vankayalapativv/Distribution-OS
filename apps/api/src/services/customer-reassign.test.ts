import { describe, expect, it } from "vitest";
import { getReassignPreview, reassignCustomer, undoReassignment } from "./customer-reassign";
import { makeSql } from "../test/sql-mock";

const CUST = "cust-1";
const OWNER = "owner-1";
const TO = "to-1";
const CTX = { userId: "admin-1" };

const COUNTS = { orders: 2, collections: 1, invoices: 0, visits: 3, photos: 0, notes: 1, beatDays: 4 };
const historyRow = (over: Record<string, unknown> = {}) => ({
  id: "ra1",
  fromUserId: OWNER,
  fromUserName: "Old SE",
  toUserId: TO,
  toUserName: "New SE",
  assignedByName: "Admin",
  createdAt: new Date("2026-06-01T10:00:00Z"),
  undoneAt: null,
  counts: COUNTS,
  ...over,
});

describe("getReassignPreview", () => {
  it("returns owner, counts, SE list and the undoable entry when the customer has an owner", async () => {
    const sql = makeSql({
      reassign_customer: [{ id: CUST, customerCode: "C001", legalName: "Ravi Motors", ownerId: OWNER, ownerName: "Old SE" }],
      reassign_counts: [COUNTS],
      reassign_history: [historyRow({ undoneAt: null }), historyRow({ id: "ra0", undoneAt: new Date() })],
      reassign_list_ses: [{ id: TO, name: "New SE" }],
    });
    const preview = await getReassignPreview(sql, CUST);
    expect(preview.currentOwner).toEqual({ id: OWNER, name: "Old SE" });
    expect(preview.counts).toEqual(COUNTS);
    expect(preview.undoable?.id).toBe("ra1");
    expect(preview.salesExecutives).toEqual([{ id: TO, name: "New SE" }]);
    expect(preview.customer.customerCode).toBe("C001");
  });

  it("returns zeroed counts and a null owner for an unowned customer", async () => {
    const sql = makeSql({
      reassign_customer: [{ id: CUST, customerCode: null, legalName: "Orphan", ownerId: null, ownerName: null }],
      reassign_history: [],
      reassign_list_ses: [],
    });
    const preview = await getReassignPreview(sql, CUST);
    expect(preview.currentOwner).toBeNull();
    expect(preview.counts).toMatchObject({ orders: 0, beatDays: 0 });
    expect(preview.undoable).toBeNull();
  });

  it("coerces absent counts (null fields) to 0 and a null createdAt to ''", async () => {
    const sql = makeSql({
      reassign_customer: [{ id: CUST, customerCode: null, legalName: "Ravi", ownerId: OWNER, ownerName: "Old" }],
      reassign_counts: [{}], // every count field absent → num() falls back to 0
      reassign_history: [historyRow({ createdAt: null, counts: undefined })],
      reassign_list_ses: [],
    });
    const preview = await getReassignPreview(sql, CUST);
    expect(preview.counts).toMatchObject({ orders: 0, visits: 0, beatDays: 0 });
    expect(preview.history[0].createdAt).toBe("");
    expect(preview.history[0].counts.orders).toBe(0);
  });

  it("throws 404 when the customer does not exist", async () => {
    const sql = makeSql({ reassign_customer: [] });
    await expect(getReassignPreview(sql, CUST)).rejects.toMatchObject({ status: 404 });
  });
});

describe("reassignCustomer", () => {
  const owned = { reassign_customer: [{ id: CUST, legalName: "Ravi", ownerId: OWNER, ownerName: "Old" }] };

  it("moves ownership and returns the new history entry", async () => {
    const sql = makeSql({
      ...owned,
      reassign_assert_se: [{ ok: 1 }],
      reassign_customer_apply: [{ id: "ra1" }],
      reassign_history_by_id: [historyRow()],
    });
    const entry = await reassignCustomer(sql, CTX, CUST, TO);
    expect(entry).toMatchObject({ id: "ra1", toUserId: TO, counts: COUNTS });
  });

  it("rejects (422) when the customer has no current owner", async () => {
    const sql = makeSql({ reassign_customer: [{ id: CUST, legalName: "x", ownerId: null, ownerName: null }] });
    await expect(reassignCustomer(sql, CTX, CUST, TO)).rejects.toMatchObject({ status: 422 });
  });

  it("rejects (422) when reassigning to the same owner", async () => {
    const sql = makeSql(owned);
    await expect(reassignCustomer(sql, CTX, CUST, OWNER)).rejects.toMatchObject({ status: 422 });
  });

  it("rejects (422) when the target is not an active sales executive", async () => {
    const sql = makeSql({ ...owned, reassign_assert_se: [] });
    await expect(reassignCustomer(sql, CTX, CUST, TO)).rejects.toMatchObject({ status: 422 });
  });

  it("throws 409 when the owner changed between read and write (apply matched no row)", async () => {
    const sql = makeSql({ ...owned, reassign_assert_se: [{ ok: 1 }], reassign_customer_apply: [] });
    await expect(reassignCustomer(sql, CTX, CUST, TO)).rejects.toMatchObject({ status: 409 });
  });
});

describe("undoReassignment", () => {
  it("reverses the latest reassignment and returns the updated entry", async () => {
    const sql = makeSql({
      reassign_undo_find: [{ id: "ra1" }],
      reassign_undo_apply: [{ id: "ra1" }],
      reassign_history_by_id: [historyRow({ undoneAt: new Date("2026-06-02T00:00:00Z") })],
    });
    const entry = await undoReassignment(sql, CTX, CUST);
    expect(entry.id).toBe("ra1");
    expect(entry.undoneAt).not.toBeNull();
  });

  it("throws 409 when there is nothing to undo", async () => {
    const sql = makeSql({ reassign_undo_find: [] });
    await expect(undoReassignment(sql, CTX, CUST)).rejects.toMatchObject({ status: 409 });
  });

  it("throws 409 when the undo apply races to no row (already undone)", async () => {
    const sql = makeSql({ reassign_undo_find: [{ id: "ra1" }], reassign_undo_apply: [] });
    await expect(undoReassignment(sql, CTX, CUST)).rejects.toMatchObject({ status: 409 });
  });
});
