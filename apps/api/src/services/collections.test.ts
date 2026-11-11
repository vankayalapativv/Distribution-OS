import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  recomputeCustomerBalances: vi.fn().mockResolvedValue(undefined),
  customerOwnerSE: vi.fn().mockResolvedValue(null),
  applyAllocationToOpening: vi.fn().mockResolvedValue(undefined),
  reverseAllocationFromOpening: vi.fn().mockResolvedValue(undefined),
  getOpeningTarget: vi.fn().mockResolvedValue(null),
}));
vi.mock("./reconcile-recompute", () => ({ recomputeCustomerBalances: h.recomputeCustomerBalances }));
vi.mock("./orders", () => ({ customerOwnerSE: h.customerOwnerSE }));
vi.mock("./opening-balance", () => ({
  applyAllocationToOpening: h.applyAllocationToOpening,
  getOpeningTarget: h.getOpeningTarget,
  reverseAllocationFromOpening: h.reverseAllocationFromOpening,
}));

import {
  createCollection,
  listCollectors,
  reReconcileCustomer,
  updateCollection,
  verifyCollection,
} from "./collections";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "admin-1" };
const CUST = "cust-1";

afterEach(() => vi.clearAllMocks());

describe("listCollectors", () => {
  it("labels each collector by their highest-priority role", async () => {
    const sql = makeSql({
      list_collectors: [
        { id: "u1", name: "Asha", roles: "SALES_EXECUTIVE,MANAGER" },
        { id: "u2", name: "Ravi", roles: "LOGISTICS" },
        { id: "u3", name: "Sri", roles: "SUPER_ADMIN" },
        { id: "u4", name: "Meena", roles: "MANAGER" },
        { id: "u5", name: "Anil", roles: "ACCOUNTANT" },
        { id: "u6", name: "NoRole", roles: null },
        { id: "u7", name: "Guest", roles: "GUEST" }, // truthy but no known role → ""
      ],
    });
    const out = await listCollectors(sql);
    expect(out.map((c) => c.roleLabel)).toEqual([
      "Sales Executive", "Logistics", "Super Admin", "Manager", "Accountant", "", "",
    ]);
  });
});

/** The tags getCollectionById needs so an enriched return doesn't throw. */
const detailTags = () => ({
  get_collection_by_id: [{ id: "col-1", customerId: CUST, collectionAmount: "300" }],
  get_collection_allocations: [],
  get_collection_proof_meta: [],
});

describe("createCollection — concurrent idempotent replay recovery", () => {
  it("returns the winning row when the insert loses the client_uuid race", async () => {
    let seen = 0;
    const sql = makeSql({
      // up-front check misses, recovery check finds the winner
      get_collection_by_client_uuid: () => (seen++ === 0 ? [] : [{ id: "col-1", customerId: CUST, collectionAmount: "100" }]),
      next_collection_code: [{ next_seq: 1 }],
      create_collection: [],
    });
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw Object.assign(new Error("dup"), { code: "23505", constraint: "collections_client_uuid_unique" });
    };
    const res = await createCollection(sql, CTX, {
      clientUuid: "uuid-1", customerId: CUST, collectedByUserId: "se-1",
      collectionDate: "2026-06-01", paymentMode: "cash", collectionType: "general",
      paymentReferenceNumber: null, collectionAmount: 100, chequeDate: null, bankName: null, remarks: null,
      invoiceId: null,
    } as never);
    expect(res).toMatchObject({ existing: true });
  });

  it("rethrows a non-replay transaction error", async () => {
    const sql = makeSql({ next_collection_code: [{ next_seq: 1 }], create_collection: [] });
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(
      createCollection(sql, CTX, {
        clientUuid: null, customerId: CUST, collectedByUserId: "se-1",
        collectionDate: "2026-06-01", paymentMode: "cash", collectionType: "general",
        paymentReferenceNumber: null, collectionAmount: 100, chequeDate: null, bankName: null, remarks: null,
        invoiceId: null,
      } as never),
    ).rejects.toThrow("db boom");
  });
});

describe("verifyCollection — explicit allocations", () => {
  const verifyRow = [{ id: "col-1", customerId: CUST, collectionAmount: "50" }];

  it("applies a fitting explicit allocation and returns when nothing spills", async () => {
    h.getOpeningTarget.mockResolvedValue(null);
    const sql = makeSql({
      verify_collection: verifyRow,
      get_allocations_for_reconcile: [{ invoiceId: "inv-1", allocatedAmount: "50" }],
      explicit_alloc_target_outstanding: [{ o: "100" }], // fits fully → excess 0
      list_held_credit_sources: [], // no held credit → early return
      ...detailTags(),
    });
    await verifyCollection(sql, CTX, "col-1");
    expect(calledTag(sql, "apply_allocation_to_invoice")).toBe(true);
    expect(h.recomputeCustomerBalances).toHaveBeenCalled();
  });

  it("caps (shrink), drops (delete), and spills the excess oldest-first", async () => {
    h.getOpeningTarget.mockResolvedValue(null);
    const sql = makeSql({
      verify_collection: [{ id: "col-1", customerId: CUST, collectionAmount: "150" }],
      get_allocations_for_reconcile: [
        { invoiceId: "inv-1", allocatedAmount: "100" },
        { invoiceId: "inv-2", allocatedAmount: "50" },
      ],
      // outstanding per invoice (routed by the bound id param)
      explicit_alloc_target_outstanding: ({ params }) => (params[0] === "inv-1" ? [{ o: "60" }] : [{ o: "0" }]),
      // spill target (null due date → the 9999 fallback sort key)
      list_outstanding_invoices_for_reconcile: [{ id: "inv-3", outstandingAmount: "90", dueDate: null, createdAt: "2026-06-01" }],
      list_held_credit_sources: [],
      ...detailTags(),
    });
    await verifyCollection(sql, CTX, "col-1");
    expect(calledTag(sql, "cap_explicit_allocation")).toBe(true); // shrink
    expect(calledTag(sql, "drop_unfittable_explicit_allocation")).toBe(true); // delete
    expect(calledTag(sql, "create_collection_allocation")).toBe(true); // spilled oldest-first
  });
});

describe("updateCollection", () => {
  const base = { collectionDate: "2026-06-02", paymentMode: "cash", collectionAmount: 300, paymentReferenceNumber: null, remarks: null };

  it("rejects a non-positive amount or an invalid mode (422)", async () => {
    await expect(updateCollection(makeSql(), CTX, "col-1", { ...base, collectionAmount: 0 })).rejects.toMatchObject({ status: 422 });
    await expect(updateCollection(makeSql(), CTX, "col-1", { ...base, paymentMode: "gold" })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when missing, 409s when rejected", async () => {
    await expect(updateCollection(makeSql({ get_collection_for_update: [] }), CTX, "x", base)).rejects.toMatchObject({ status: 404 });
    await expect(
      updateCollection(makeSql({ get_collection_for_update: [{ id: "col-1", customerId: CUST, status: "rejected" }] }), CTX, "col-1", base),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("edits a pending collection without touching allocations", async () => {
    const sql = makeSql({ get_collection_for_update: [{ id: "col-1", customerId: CUST, status: "pending" }], ...detailTags() });
    await updateCollection(sql, CTX, "col-1", base);
    expect(calledTag(sql, "update_collection")).toBe(true);
    expect(calledTag(sql, "list_allocations_to_reverse")).toBe(false); // not verified → no reverse
  });

  it("reverses, re-reconciles (opening + invoices) and re-applies held credit for a verified edit", async () => {
    h.getOpeningTarget.mockResolvedValue({ id: "ob-1", outstanding: 200 });
    const sql = makeSql({
      get_collection_for_update: [{ id: "col-1", customerId: CUST, status: "verified" }],
      // reverse: one invoice alloc + one opening alloc
      list_allocations_to_reverse: [
        { invoiceId: "inv-x", openingBalanceId: null, allocatedAmount: "100" },
        { invoiceId: null, openingBalanceId: "ob-1", allocatedAmount: "50" },
      ],
      update_collection: [],
      get_allocations_for_reconcile: [], // general payment → oldest-first
      list_outstanding_invoices_for_reconcile: [{ id: "inv-1", outstandingAmount: "200", dueDate: "2026-06-01", createdAt: "2026-06-01" }],
      // held credit: two sources, opening + invoice targets (exercises exhaust + spill)
      list_held_credit_sources: [{ id: "c1", remaining: "200" }, { id: "c2", remaining: "100" }],
      list_open_invoices_for_credit: [{ id: "inv-2", outstandingAmount: "150" }],
      ...detailTags(),
    });
    await updateCollection(sql, CTX, "col-1", base);
    expect(calledTag(sql, "reverse_allocation_from_invoice")).toBe(true);
    expect(h.reverseAllocationFromOpening).toHaveBeenCalledWith(sql, "ob-1", 50);
    expect(calledTag(sql, "create_opening_allocation")).toBe(true); // oldest-first opening
    expect(calledTag(sql, "create_credit_allocation_opening")).toBe(true); // held credit → opening
    expect(calledTag(sql, "create_credit_allocation")).toBe(true); // held credit → invoice
    expect(h.applyAllocationToOpening).toHaveBeenCalled();
  });
});

describe("reReconcileCustomer", () => {
  it("undoes, resets the opening, and replays every verified collection", async () => {
    h.getOpeningTarget.mockResolvedValue(null);
    const sql = makeSql({
      list_verified_collections_for_rereconcile: [{ id: "col-1", collectionAmount: "100" }],
      list_allocations_to_reverse: [{ invoiceId: "inv-1", openingBalanceId: null, allocatedAmount: "100" }],
      get_allocations_for_reconcile: [],
      list_outstanding_invoices_for_reconcile: [],
      list_held_credit_sources: [],
    });
    await reReconcileCustomer(sql, CTX, CUST);
    expect(calledTag(sql, "reverse_allocation_from_invoice")).toBe(true);
    expect(calledTag(sql, "reset_opening_for_rereconcile")).toBe(true);
  });
});
