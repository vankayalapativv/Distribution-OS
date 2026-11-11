export interface CreditNoteForm {
  collectedByUserId: string;
  date: string;
  invoiceId: string;
  amount: string;
  referenceNo: string;
  remarks: string;
}

export const emptyCreditNoteForm = (): CreditNoteForm => ({
  collectedByUserId: "", date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  invoiceId: "", amount: "", referenceNo: "", remarks: "",
});

/** Build the POST /collections body for a credit note (a verification-required
 *  credit tagged `credit_note` that offsets a chosen outstanding invoice). */
export function buildCreditNotePayload(customerId: string, form: CreditNoteForm, clientUuid: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customerId,
    collectedByUserId: form.collectedByUserId,
    collectionDate: form.date,
    paymentMode: "credit_note",
    collectionType: "general",
    collectionAmount: Number(form.amount),
    invoiceId: form.invoiceId,
    clientUuid,
  };
  if (form.referenceNo) payload.paymentReferenceNumber = form.referenceNo;
  if (form.remarks) payload.remarks = form.remarks;
  return payload;
}

export const creditNoteCanSubmit = (form: CreditNoteForm): boolean =>
  !!form.collectedByUserId && !!form.invoiceId && Number(form.amount) > 0;
