/**
 * The vendor that ISSUES the software-subscription receipt (Vardhan Systems — the
 * developer/biller), distinct from the client (the recipient, read from the
 * Settings → Company profile and shown as "Billed to"). Single-vendor, so these
 * are constants. Client in Telangana + vendor in Telangana ⇒ intra-state GST
 * (9% CGST + 9% SGST); serving an out-of-state client later would mean IGST 18%.
 */
export const RECEIPT_VENDOR = {
  legalName: "Vardhan Systems LLP",
  gstin: "36ABCFV4900D1ZH",
  pan: "ABCFV4900D",
  address: "15-3-132/7/B, Tekulapalli, Khanapuram Haveli (Rural), Khammam – 507002",
  state: "Telangana",
  email: "vishnuvardhan@vardhansystems.in",
  phone: "+91 63048 00595",
  sac: "998314",
  logo: "/vardhan-systems-logo.png",
} as const;
