import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createExpenditure,
  createExpenditureCategory,
  deleteExpenditure,
  getExpenditureBill,
  getExpenditureById,
  getExpenditureSummary,
  listExpenditureCategories,
  listExpenditurePeople,
  listExpenditures,
  updateExpenditure,
  uploadExpenditureBill,
} from "./expenditures";
import { makeSql, calledTag } from "../test/sql-mock";

const CTX = { userId: "admin-1" };
const EXP_ROW = {
  id: "e1", expenditureCode: "EXP-0001", expenditureDate: "2026-06-01", categoryId: "cat-1",
  categoryName: "Fuel", type: "variable", amount: "500", paymentMode: "cash", paidTo: "Pump",
  userId: "se-1", userName: "Asha", remarks: null, billFileKey: null, createdAt: "2026-06-01",
};
const fakeFile = (over = {}) => ({ type: "image/jpeg", size: 100, arrayBuffer: async () => new ArrayBuffer(4), ...over }) as unknown as File;
const fakeBucket = () => ({ put: vi.fn().mockResolvedValue(undefined), get: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) });

afterEach(() => vi.clearAllMocks());

describe("categories + people", () => {
  it("lists active categories", async () => {
    const sql = makeSql({ list_expenditure_categories: [{ id: "c1", name: "Fuel", type: "variable", isSystem: true, isActive: true }] });
    expect((await listExpenditureCategories(sql))[0]).toMatchObject({ name: "Fuel", type: "variable", isSystem: true });
  });

  it("creates a category (blank/type 422, duplicate 409, happy)", async () => {
    await expect(createExpenditureCategory(makeSql(), CTX, { name: "  ", type: "variable" })).rejects.toMatchObject({ status: 422 });
    await expect(createExpenditureCategory(makeSql(), CTX, { name: "X", type: "weird" as never })).rejects.toMatchObject({ status: 422 });
    await expect(createExpenditureCategory(makeSql({ expenditure_category_exists: [{ id: "dup" }] }), CTX, { name: "Fuel", type: "variable" })).rejects.toMatchObject({ status: 409 });
    const sql = makeSql({ expenditure_category_exists: [], create_expenditure_category: [{ id: "c9", name: "Gifts", type: "variable", isSystem: false, isActive: true }] });
    expect(await createExpenditureCategory(sql, CTX, { name: "Gifts", type: "variable" })).toMatchObject({ id: "c9", isSystem: false });
  });

  it("lists attributable people", async () => {
    const sql = makeSql({ list_expenditure_people: [{ id: "se-1", name: "Asha" }] });
    expect(await listExpenditurePeople(sql)).toEqual([{ id: "se-1", name: "Asha" }]);
  });
});

describe("listExpenditures", () => {
  it("applies every filter and returns rows + totals", async () => {
    const sql = makeSql({
      list_expenditures_count: [{ total: 1, total_amount: "500" }],
      list_expenditures: [EXP_ROW],
    });
    const res = await listExpenditures(sql, { from: "2026-06-01", to: "2026-06-30", categoryId: "cat-1", type: "variable", userId: "se-1", search: "fuel", page: 1, pageSize: 20 });
    expect(res).toMatchObject({ total: 1, totalAmount: 500 });
    expect(res.rows[0]).toMatchObject({ expenditureCode: "EXP-0001", hasBill: false });
    const countCall = sql.calls.find((c) => c.tag === "list_expenditures_count")!;
    expect(countCall.params).toEqual(expect.arrayContaining(["2026-06-01", "cat-1", "variable", "se-1", "%fuel%"]));
  });

  it("ignores an unknown type filter and defaults totals", async () => {
    const sql = makeSql({ list_expenditures_count: [], list_expenditures: [] });
    const res = await listExpenditures(sql, { type: "bogus" });
    expect(res).toMatchObject({ total: 0, totalAmount: 0 });
  });
});

describe("getExpenditureById", () => {
  it("maps it or 404s", async () => {
    expect(await getExpenditureById(makeSql({ get_expenditure_by_id: [EXP_ROW] }), "e1")).toMatchObject({ id: "e1" });
    await expect(getExpenditureById(makeSql({ get_expenditure_by_id: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
});

const input = (over = {}) => ({ expenditureDate: "2026-06-01", categoryId: "cat-1", amount: 500, paymentMode: "cash", paidTo: "Pump", userId: "se-1", remarks: null, ...over });

describe("createExpenditure", () => {
  it("validates date/category/amount/payment-mode (422)", async () => {
    await expect(createExpenditure(makeSql(), CTX, input({ expenditureDate: "" }))).rejects.toMatchObject({ status: 422 });
    await expect(createExpenditure(makeSql(), CTX, input({ categoryId: "" }))).rejects.toMatchObject({ status: 422 });
    await expect(createExpenditure(makeSql(), CTX, input({ amount: 0 }))).rejects.toMatchObject({ status: 422 });
    await expect(createExpenditure(makeSql(), CTX, input({ paymentMode: "gold" }))).rejects.toMatchObject({ status: 422 });
  });

  it("404s an unknown/inactive category", async () => {
    await expect(createExpenditure(makeSql({ expenditure_category_for_entry: [] }), CTX, input())).rejects.toMatchObject({ status: 404 });
  });

  it("creates with a generated code (null userId tolerated)", async () => {
    const sql = makeSql({
      expenditure_category_for_entry: [{ id: "cat-1" }],
      next_expenditure_code: [{ next_seq: 1 }],
      create_expenditure: [{ id: "e1" }],
      get_expenditure_by_id: [EXP_ROW],
    });
    expect(await createExpenditure(sql, CTX, input({ userId: null }))).toMatchObject({ id: "e1" });
    expect(calledTag(sql, "create_expenditure")).toBe(true);
  });

  it("replays an existing expenditure by clientUuid", async () => {
    const sql = makeSql({ get_expenditure_by_client_uuid: [{ id: "e1" }], get_expenditure_by_id: [EXP_ROW] });
    expect(await createExpenditure(sql, CTX, input({ clientUuid: "u1" }))).toMatchObject({ id: "e1" });
  });

  it("recovers the winner on a concurrent client_uuid race, and rethrows other errors", async () => {
    let seen = 0;
    const sql = makeSql({
      get_expenditure_by_client_uuid: () => (seen++ === 0 ? [] : [{ id: "e1" }]),
      expenditure_category_for_entry: [{ id: "cat-1" }],
      next_expenditure_code: [{ next_seq: 1 }],
      create_expenditure: () => {
        throw Object.assign(new Error("dup"), { code: "23505", constraint: "expenditures_client_uuid_unique" });
      },
      get_expenditure_by_id: [EXP_ROW],
    });
    expect(await createExpenditure(sql, CTX, input({ clientUuid: "u1" }))).toMatchObject({ id: "e1" });

    const boom = makeSql({
      expenditure_category_for_entry: [{ id: "cat-1" }],
      next_expenditure_code: [{ next_seq: 1 }],
      create_expenditure: () => {
        throw new Error("db boom");
      },
    });
    await expect(createExpenditure(boom, CTX, input())).rejects.toThrow("db boom");
  });
});

describe("updateExpenditure", () => {
  it("updates or 404s", async () => {
    const sql = makeSql({ update_expenditure: [{ id: "e1" }], get_expenditure_by_id: [EXP_ROW] });
    expect(await updateExpenditure(sql, "e1", input())).toMatchObject({ id: "e1" });
    await expect(updateExpenditure(makeSql({ update_expenditure: [] }), "x", input())).rejects.toMatchObject({ status: 404 });
  });
});

describe("deleteExpenditure", () => {
  it("deletes + removes the bill object, or 404s", async () => {
    const bucket = fakeBucket();
    expect(await deleteExpenditure(makeSql({ delete_expenditure: [{ billFileKey: "k1" }] }), bucket as never, "e1")).toEqual({ deleted: true });
    expect(bucket.delete).toHaveBeenCalledWith("k1");
    // no bill key → no R2 delete
    const b2 = fakeBucket();
    await deleteExpenditure(makeSql({ delete_expenditure: [{ billFileKey: null }] }), b2 as never, "e1");
    expect(b2.delete).not.toHaveBeenCalled();
    await expect(deleteExpenditure(makeSql({ delete_expenditure: [] }), undefined, "x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getExpenditureSummary", () => {
  it("splits compulsory vs variable + per-category", async () => {
    const sql = makeSql({
      expenditure_summary_by_category: [
        { categoryId: "c1", categoryName: "Rent", type: "compulsory", entries: "1", amount: "10000" },
        { categoryId: "c2", categoryName: "Fuel", type: "variable", entries: "3", amount: "1500" },
      ],
    });
    const out = await getExpenditureSummary(sql, { from: "2026-06-01", to: "2026-06-30" });
    expect(out).toMatchObject({ total: 11500, compulsory: 10000, variable: 1500, entries: 4 });
    expect(out.categories).toHaveLength(2);
  });
});

describe("uploadExpenditureBill", () => {
  it("validates type/size (422)", async () => {
    const b = fakeBucket();
    await expect(uploadExpenditureBill(makeSql(), b as never, "e1", fakeFile({ type: "text/plain" }))).rejects.toMatchObject({ status: 422 });
    await expect(uploadExpenditureBill(makeSql(), b as never, "e1", fakeFile({ size: 0 }))).rejects.toMatchObject({ status: 422 });
    await expect(uploadExpenditureBill(makeSql(), b as never, "e1", fakeFile({ size: 11 * 1024 * 1024 }))).rejects.toMatchObject({ status: 422 });
  });

  it("404s a missing expenditure", async () => {
    await expect(uploadExpenditureBill(makeSql({ expenditure_for_bill: [] }), fakeBucket() as never, "x", fakeFile())).rejects.toMatchObject({ status: 404 });
  });

  it("stores a PDF bill and drops the previous object", async () => {
    const bucket = fakeBucket();
    const sql = makeSql({ expenditure_for_bill: [{ id: "e1", billFileKey: "old-key" }] });
    const res = await uploadExpenditureBill(sql, bucket as never, "e1", fakeFile({ type: "application/pdf" }));
    expect(res).toMatchObject({ uploaded: true, contentType: "application/pdf" });
    expect(bucket.put).toHaveBeenCalledOnce();
    expect(bucket.delete).toHaveBeenCalledWith("old-key");
    expect(calledTag(sql, "set_expenditure_bill")).toBe(true);
  });
});

describe("getExpenditureBill", () => {
  it("streams the bill", async () => {
    const bucket = { get: vi.fn().mockResolvedValue({ body: "STREAM" }) };
    const sql = makeSql({ get_expenditure_bill: [{ fileKey: "k1", contentType: "image/png" }] });
    expect(await getExpenditureBill(sql, bucket as never, "e1")).toMatchObject({ contentType: "image/png" });
  });

  it("404s when there's no key or the object is gone", async () => {
    await expect(getExpenditureBill(makeSql({ get_expenditure_bill: [{ fileKey: null }] }), { get: vi.fn() } as never, "e1")).rejects.toMatchObject({ status: 404 });
    const bucket = { get: vi.fn().mockResolvedValue(null) };
    await expect(getExpenditureBill(makeSql({ get_expenditure_bill: [{ fileKey: "k1", contentType: "" }] }), bucket as never, "e1")).rejects.toMatchObject({ status: 404 });
  });
});
