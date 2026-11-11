export interface CollectionDetail {
  id: string;
  collectionCode: string;
  collectionDate: string;
  paymentMode: string;
  paymentReferenceNumber: string | null;
  collectionAmount: number | string;
  remarks: string | null;
  accountantApprovalStatus: string;
}

export const MODES: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "neft_rtgs", label: "NEFT / RTGS" },
  { value: "credit_note", label: "Credit Note" },
];

export const modeLabel = (v: string) => MODES.find((m) => m.value === v)?.label ?? v;

export interface CollectionEditFields {
  amount: string;
  date: string;
  mode: string;
  reference: string;
  remark: string;
}

/** Initial form values from a loaded collection. */
export function seedFromCollection(data: CollectionDetail): CollectionEditFields {
  return {
    amount: String(Number(data.collectionAmount)),
    date: (data.collectionDate ?? "").slice(0, 10),
    mode: data.paymentMode,
    reference: data.paymentReferenceNumber ?? "",
    remark: data.remarks ?? "",
  };
}

/** Validate the edit. Returns { amount } (parsed) or an error string. */
export function validateCollectionEdit(amount: string, date: string): { amount: number } | { error: string } {
  const amt = Number(amount);
  if (!(amt > 0)) return { error: "Enter an amount greater than 0." };
  if (!date) return { error: "Pick a date." };
  return { amount: amt };
}

/** PATCH /collections/:id body from the edited fields. */
export function collectionEditPayload(f: CollectionEditFields, amount: number) {
  return {
    collectionDate: f.date,
    paymentMode: f.mode,
    collectionAmount: amount,
    paymentReferenceNumber: f.reference.trim() || null,
    remarks: f.remark.trim() || null,
  };
}
