import { describe, expect, it } from "vitest";
import { buildCreditNotePayload, creditNoteCanSubmit, emptyCreditNoteForm } from "./credit-note-payload";

const form = { ...emptyCreditNoteForm(), collectedByUserId: "u1", invoiceId: "inv1", amount: "500", date: "2026-09-14" };

describe("buildCreditNotePayload", () => {
  it("tags the payload as a credit note against the chosen invoice", () => {
    const p = buildCreditNotePayload("cu1", form, "uuid-1");
    expect(p).toMatchObject({
      customerId: "cu1", collectedByUserId: "u1", collectionDate: "2026-09-14",
      paymentMode: "credit_note", collectionType: "general", collectionAmount: 500,
      invoiceId: "inv1", clientUuid: "uuid-1",
    });
  });

  it("includes reference/remarks only when present", () => {
    expect(buildCreditNotePayload("cu1", form, "u")).not.toHaveProperty("remarks");
    const p = buildCreditNotePayload("cu1", { ...form, referenceNo: "CN9", remarks: "adj" }, "u");
    expect(p).toMatchObject({ paymentReferenceNumber: "CN9", remarks: "adj" });
  });
});

describe("creditNoteCanSubmit", () => {
  it("requires issuer, invoice and a positive amount", () => {
    expect(creditNoteCanSubmit(form)).toBe(true);
    expect(creditNoteCanSubmit({ ...form, amount: "0" })).toBe(false);
    expect(creditNoteCanSubmit({ ...form, invoiceId: "" })).toBe(false);
    expect(creditNoteCanSubmit({ ...form, collectedByUserId: "" })).toBe(false);
  });
});

describe("emptyCreditNoteForm", () => {
  it("defaults the date to today and clears the rest", () => {
    const f = emptyCreditNoteForm();
    expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.amount).toBe("");
    expect(f.invoiceId).toBe("");
  });
});
