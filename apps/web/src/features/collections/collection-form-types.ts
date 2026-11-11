export interface CollectionForm {
  customerId: string;
  collectedByUserId: string;
  collectionDate: string;
  paymentMode: string;
  collectionAmount: string;
  paymentReferenceNumber: string;
  chequeDate: string;
  bankName: string;
  remarks: string;
}

export const EMPTY_COLLECTION_FORM: CollectionForm = {
  customerId: "",
  collectedByUserId: "",
  collectionDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  paymentMode: "cash",
  collectionAmount: "",
  paymentReferenceNumber: "",
  chequeDate: "",
  bankName: "",
  remarks: "",
};

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "neft_rtgs", label: "NEFT / RTGS" },
];
