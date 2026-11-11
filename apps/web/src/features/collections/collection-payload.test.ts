import { describe, expect, it } from "vitest";
import { buildCollectionPayload, isCollectionDraftEmpty } from "./collection-payload";
import { EMPTY_COLLECTION_FORM, type CollectionForm } from "./collection-form-types";

const base: CollectionForm = {
  ...EMPTY_COLLECTION_FORM,
  customerId: "cu1", collectedByUserId: "u1", collectionDate: "2026-09-14",
  paymentMode: "cash", collectionAmount: "5000",
};

describe("buildCollectionPayload", () => {
  it("includes the required fields and coerces the amount to a number", () => {
    const p = buildCollectionPayload(base, "uuid-1");
    expect(p).toEqual({
      customerId: "cu1", collectedByUserId: "u1", collectionDate: "2026-09-14",
      paymentMode: "cash", collectionAmount: 5000, clientUuid: "uuid-1",
    });
  });

  it("adds the optional fields only when filled", () => {
    const p = buildCollectionPayload(
      { ...base, paymentReferenceNumber: "UTR9", chequeDate: "2026-09-10", bankName: "SBI", remarks: "note" },
      "uuid-2",
    );
    expect(p).toMatchObject({ paymentReferenceNumber: "UTR9", chequeDate: "2026-09-10", bankName: "SBI", remarks: "note" });
  });

  it("omits blank optional fields", () => {
    const p = buildCollectionPayload(base, "uuid-3");
    expect(p).not.toHaveProperty("paymentReferenceNumber");
    expect(p).not.toHaveProperty("bankName");
  });
});

describe("isCollectionDraftEmpty", () => {
  it("is empty when only a locked customer is set", () => {
    expect(isCollectionDraftEmpty({ ...EMPTY_COLLECTION_FORM, customerId: "cu1" }, "cu1")).toBe(true);
    expect(isCollectionDraftEmpty(EMPTY_COLLECTION_FORM)).toBe(true);
  });

  it("is not empty once the user enters real data", () => {
    expect(isCollectionDraftEmpty({ ...EMPTY_COLLECTION_FORM, collectionAmount: "100" })).toBe(false);
    expect(isCollectionDraftEmpty({ ...EMPTY_COLLECTION_FORM, remarks: "x" })).toBe(false);
    // a different customer than the locked one counts as data
    expect(isCollectionDraftEmpty({ ...EMPTY_COLLECTION_FORM, customerId: "other" }, "cu1")).toBe(false);
  });
});
