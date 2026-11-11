import type { CollectionForm } from "./collection-form-types";

/** Build the POST /collections body — required fields always, optional ones only
 *  when filled (matches the API's partial-field contract). */
export function buildCollectionPayload(form: CollectionForm, clientUuid: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customerId: form.customerId,
    collectedByUserId: form.collectedByUserId,
    collectionDate: form.collectionDate,
    paymentMode: form.paymentMode,
    collectionAmount: Number(form.collectionAmount),
    clientUuid,
  };
  if (form.paymentReferenceNumber) payload.paymentReferenceNumber = form.paymentReferenceNumber;
  if (form.chequeDate) payload.chequeDate = form.chequeDate;
  if (form.bankName) payload.bankName = form.bankName;
  if (form.remarks) payload.remarks = form.remarks;
  return payload;
}

/** True when only a locked/prefilled customer is set — nothing worth persisting
 *  as a draft yet (amount, collector, references, remarks all blank). */
export function isCollectionDraftEmpty(form: CollectionForm, initialCustomerId?: string): boolean {
  return (
    !form.collectionAmount &&
    !form.collectedByUserId &&
    !form.paymentReferenceNumber &&
    !form.chequeDate &&
    !form.bankName &&
    !form.remarks &&
    (!form.customerId || form.customerId === (initialCustomerId ?? ""))
  );
}
