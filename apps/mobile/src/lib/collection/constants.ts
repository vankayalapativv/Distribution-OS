/** Payment modes shared by the record-collection form + confirmation. */
export const PAYMENT_MODES = [
  { key: "cash", label: "Cash" },
  { key: "cheque", label: "Cheque" },
  { key: "upi", label: "UPI" },
  { key: "neft_rtgs", label: "NEFT/RTGS" },
] as const;
