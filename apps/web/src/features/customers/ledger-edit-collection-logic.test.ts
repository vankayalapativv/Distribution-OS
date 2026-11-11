import { describe, expect, it } from "vitest";
import {
  collectionEditPayload,
  modeLabel,
  seedFromCollection,
  validateCollectionEdit,
  type CollectionDetail,
} from "./ledger-edit-collection-logic";

const detail = (over: Partial<CollectionDetail> = {}): CollectionDetail => ({
  id: "col1",
  collectionCode: "COL-1",
  collectionDate: "2026-07-01T00:00:00.000Z",
  paymentMode: "upi",
  paymentReferenceNumber: "UTR9",
  collectionAmount: "1500.00",
  remarks: "adv",
  accountantApprovalStatus: "pending",
  ...over,
});

describe("modeLabel", () => {
  it("maps known modes and passes through unknown ones", () => {
    expect(modeLabel("neft_rtgs")).toBe("NEFT / RTGS");
    expect(modeLabel("weird")).toBe("weird");
  });
});

describe("seedFromCollection", () => {
  it("derives form values, numericizing the amount and slicing the date", () => {
    expect(seedFromCollection(detail())).toEqual({
      amount: "1500",
      date: "2026-07-01",
      mode: "upi",
      reference: "UTR9",
      remark: "adv",
    });
  });
  it("defaults null reference/remark to empty strings and a null date to ''", () => {
    const s = seedFromCollection(detail({ paymentReferenceNumber: null, remarks: null, collectionDate: null as unknown as string }));
    expect(s.reference).toBe("");
    expect(s.remark).toBe("");
    expect(s.date).toBe("");
  });
});

describe("validateCollectionEdit", () => {
  it("rejects a non-positive amount and a missing date", () => {
    expect(validateCollectionEdit("0", "2026-07-01")).toEqual({ error: "Enter an amount greater than 0." });
    expect(validateCollectionEdit("100", "")).toEqual({ error: "Pick a date." });
  });
  it("returns the parsed amount when valid", () => {
    expect(validateCollectionEdit("1500", "2026-07-01")).toEqual({ amount: 1500 });
  });
});

describe("collectionEditPayload", () => {
  it("trims reference/remark to null and carries the amount", () => {
    const body = collectionEditPayload(
      { amount: "1500", date: "2026-07-01", mode: "cash", reference: "  ", remark: "note" },
      1500,
    );
    expect(body).toEqual({
      collectionDate: "2026-07-01",
      paymentMode: "cash",
      collectionAmount: 1500,
      paymentReferenceNumber: null,
      remarks: "note",
    });
  });

  it("keeps a non-empty reference and nulls an empty remark", () => {
    const body = collectionEditPayload(
      { amount: "1", date: "d", mode: "upi", reference: "UTR", remark: "  " },
      1,
    );
    expect(body.paymentReferenceNumber).toBe("UTR");
    expect(body.remarks).toBeNull();
  });
});
