import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSql, calledTag } from "../test/sql-mock";
import {
  approveClaim,
  getClaim,
  listClaimCategories,
  listClaims,
  rejectClaim,
  resubmitClaim,
  submitClaim,
} from "./expense-claims";

afterEach(() => vi.clearAllMocks());

const SE = "00000000-0000-4000-8000-000000000004";
const CAT = "00000000-0000-4000-8000-000000000a01";
const ID = "00000000-0000-4000-8000-000000000b01";

/** A DB row in the CLAIM_COLUMNS shape. */
function claimRow(over: Record<string, unknown> = {}) {
  return {
    id: ID, code: "EXP-0007", date: "2026-11-28",
    categoryId: CAT, categoryName: "Fuel — Sales Executives",
    amount: "450", claimedAmount: "450",
    status: "submitted", remarks: null, rejectReason: null,
    billFileKey: "expenditures/x/r.jpg",
    submittedBy: SE, submitterName: "Priya Field SE",
    approvedAt: null, createdAt: new Date("2026-11-28T04:00:00.000Z"),
    ...over,
  };
}
const variableCat = { claim_category_check: [{ type: "variable" }] };

describe("listClaimCategories", () => {
  it("returns active variable categories", async () => {
    const sql = makeSql({ claim_categories: [{ id: "c1", name: "Fuel" }, { id: "c2", name: "Food" }] });
    expect(await listClaimCategories(sql)).toEqual([{ id: "c1", name: "Fuel" }, { id: "c2", name: "Food" }]);
  });
});

describe("submitClaim", () => {
  it("rejects a non-positive amount", async () => {
    await expect(submitClaim(makeSql(), SE, { categoryId: CAT, amount: 0, expenditureDate: "2026-11-28" }))
      .rejects.toMatchObject({ status: 422 });
  });

  it("404 when the category is missing", async () => {
    await expect(submitClaim(makeSql({ claim_category_check: [] }), SE, { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28" }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("422 when the category is not a variable (field) category", async () => {
    await expect(submitClaim(makeSql({ claim_category_check: [{ type: "compulsory" }] }), SE, { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28" }))
      .rejects.toMatchObject({ status: 422 });
  });

  it("returns the existing claim on an idempotent replay", async () => {
    const sql = makeSql({ ...variableCat, claim_idempotency: [{ id: ID }], get_claim: [claimRow()] });
    const claim = await submitClaim(sql, SE, { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28", clientUuid: "u1" });
    expect(claim.id).toBe(ID);
    expect(calledTag(sql, "submit_claim")).toBe(false); // short-circuited, no insert
  });

  it("inserts a submitted field claim and maps it", async () => {
    const sql = makeSql({ ...variableCat, next_claim_code: [{ seq: 7 }], submit_claim: [{ id: ID }], get_claim: [claimRow()] });
    const claim = await submitClaim(sql, SE, { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28", remarks: "trip" });
    expect(claim).toMatchObject({ id: ID, status: "submitted", amount: 450, claimedAmount: 450, hasReceipt: true, submitterName: "Priya Field SE" });
    expect(calledTag(sql, "submit_claim")).toBe(true);
  });

  it("defaults the code sequence to 1 when the table is empty", async () => {
    const sql = makeSql({ ...variableCat, next_claim_code: [{ seq: 0 }], submit_claim: [{ id: ID }], get_claim: [claimRow({ code: "EXP-0001" })] });
    const claim = await submitClaim(sql, SE, { categoryId: CAT, amount: 10, expenditureDate: "2026-11-28" });
    expect(claim.code).toBe("EXP-0001");
  });

  it("inserts when a clientUuid is given but no prior claim matches", async () => {
    const sql = makeSql({ ...variableCat, claim_idempotency: [], next_claim_code: [{ seq: 1 }], submit_claim: [{ id: ID }], get_claim: [claimRow()] });
    await submitClaim(sql, SE, { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28", clientUuid: "fresh" });
    expect(calledTag(sql, "submit_claim")).toBe(true);
  });
});

describe("getClaim", () => {
  it("404 when not found", async () => {
    await expect(getClaim(makeSql({ get_claim: [] }), ID)).rejects.toMatchObject({ status: 404 });
  });
  it("maps nulls and amounts (approved, no receipt)", async () => {
    const sql = makeSql({ get_claim: [claimRow({ status: "approved", amount: 400, billFileKey: null, remarks: "ok", approvedAt: "2026-11-28T06:00:00Z" })] });
    const claim = await getClaim(sql, ID);
    expect(claim).toMatchObject({ status: "approved", amount: 400, hasReceipt: false, remarks: "ok", rejectReason: null, approvedAt: "2026-11-28T06:00:00Z" });
  });

  it("coerces a missing amount to 0", async () => {
    const sql = makeSql({ get_claim: [claimRow({ amount: undefined, claimedAmount: undefined })] });
    expect(await getClaim(sql, ID)).toMatchObject({ amount: 0, claimedAmount: 0 });
  });
});

describe("listClaims", () => {
  it("filters by status when given", async () => {
    const sql = makeSql({ list_claims: [claimRow()] });
    const out = await listClaims(sql, { status: "submitted" });
    expect(out).toHaveLength(1);
    expect(sql.calls.find((c) => c.tag === "list_claims")!.params).toEqual(["submitted"]);
  });
  it("falls back to the whole field stream with no status", async () => {
    const sql = makeSql({ list_claims: [claimRow()] });
    await listClaims(sql, { status: "" });
    expect(sql.calls.find((c) => c.tag === "list_claims")!.text).toContain("source = 'field'");
  });
  it("scopes to one submitter", async () => {
    const sql = makeSql({ list_claims: [] });
    await listClaims(sql, { submittedBy: SE });
    expect(sql.calls.find((c) => c.tag === "list_claims")!.params).toEqual([SE]);
  });
});

describe("approveClaim", () => {
  it("409 when the claim is not submitted", async () => {
    await expect(approveClaim(makeSql({ get_claim: [claimRow({ status: "approved" })] }), "mgr", ID, null))
      .rejects.toMatchObject({ status: 409 });
  });
  it("422 when the reduced amount is out of range", async () => {
    const sql = makeSql({ get_claim: [claimRow({ claimedAmount: "450" })] });
    await expect(approveClaim(sql, "mgr", ID, 500)).rejects.toMatchObject({ status: 422 });
    await expect(approveClaim(sql, "mgr", ID, 0)).rejects.toMatchObject({ status: 422 });
  });
  it("approves in full (null → claimed amount)", async () => {
    const sql = makeSql({ get_claim: [claimRow()] });
    const claim = await approveClaim(sql, "mgr", ID, null);
    expect(calledTag(sql, "approve_claim")).toBe(true);
    expect(claim.id).toBe(ID);
  });
  it("approves a reduced amount within range", async () => {
    const sql = makeSql({ get_claim: [claimRow({ claimedAmount: "450" })] });
    await approveClaim(sql, "mgr", ID, 300);
    expect(sql.calls.find((c) => c.tag === "approve_claim")).toBeTruthy();
  });
});

describe("rejectClaim", () => {
  it("422 on a blank reason", async () => {
    await expect(rejectClaim(makeSql(), "mgr", ID, "  ")).rejects.toMatchObject({ status: 422 });
  });
  it("409 when not submitted", async () => {
    await expect(rejectClaim(makeSql({ get_claim: [claimRow({ status: "rejected" })] }), "mgr", ID, "blurry bill"))
      .rejects.toMatchObject({ status: 409 });
  });
  it("rejects a submitted claim with a reason", async () => {
    const sql = makeSql({ get_claim: [claimRow()] });
    await rejectClaim(sql, "mgr", ID, "  blurry bill  ");
    const call = sql.calls.find((c) => c.tag === "reject_claim")!;
    expect(call.params).toContain("blurry bill");
  });
});

describe("resubmitClaim", () => {
  const input = { categoryId: CAT, amount: 450, expenditureDate: "2026-11-28" };
  it("422 on a non-positive amount", async () => {
    await expect(resubmitClaim(makeSql(), SE, ID, { ...input, amount: 0 })).rejects.toMatchObject({ status: 422 });
  });
  it("404 when the claim belongs to someone else", async () => {
    const sql = makeSql({ ...variableCat, get_claim: [claimRow({ submittedBy: "other", status: "rejected" })] });
    await expect(resubmitClaim(sql, SE, ID, input)).rejects.toMatchObject({ status: 404 });
  });
  it("409 when the claim is not rejected", async () => {
    const sql = makeSql({ ...variableCat, get_claim: [claimRow({ status: "submitted" })] });
    await expect(resubmitClaim(sql, SE, ID, input)).rejects.toMatchObject({ status: 409 });
  });
  it("resubmits a rejected claim the SE owns (with and without remarks)", async () => {
    const sql = makeSql({ ...variableCat, get_claim: [claimRow({ status: "rejected" })] });
    await resubmitClaim(sql, SE, ID, { ...input, remarks: "fixed" });
    expect(calledTag(sql, "resubmit_claim")).toBe(true);
    const sql2 = makeSql({ ...variableCat, get_claim: [claimRow({ status: "rejected" })] });
    await resubmitClaim(sql2, SE, ID, input); // no remarks → ?? null branch
    expect(sql2.calls.find((c) => c.tag === "resubmit_claim")!.params).toContain(null);
  });
});
