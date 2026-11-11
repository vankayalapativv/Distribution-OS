import type { CollectionDetail } from "./collections-types";

/** A verified/pending collection detail for tests; override per case. */
export const collectionDetail = (over: Partial<CollectionDetail> = {}): CollectionDetail => ({
  id: "c1", collectionCode: "COL-0001", collectionDate: "2026-09-14", customerId: "cu1",
  customerName: "Sri Laxmi", customerCity: "Nalgonda", customerPhone: "99887",
  collectedByUserId: "u1", collectedByName: "Ravi", paymentMode: "upi", paymentReferenceNumber: null,
  collectionAmount: "5000", chequeDate: null, chequeStatus: null, bankName: null, matchedStatus: "matched",
  accountantApprovalStatus: "pending", approvedByAccountantId: null, approvedByAccountantName: null,
  approvedAt: null, incentiveEligible: false, remarks: null, createdBy: null,
  createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z",
  allocations: [], proof: null, ...over,
});
