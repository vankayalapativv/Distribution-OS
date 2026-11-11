export interface CollectionAllocation {
  id: string;
  collectionId: string;
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: string;
}

export interface Collection {
  id: string;
  collectionCode: string;
  collectionDate: string;
  customerId: string;
  customerName: string | null;
  customerCity: string | null;
  customerPhone: string | null;
  collectedByUserId: string;
  collectedByName: string | null;
  paymentMode: string;
  paymentReferenceNumber: string | null;
  collectionAmount: string;
  chequeDate: string | null;
  chequeStatus: string | null;
  bankName: string | null;
  matchedStatus: string;
  accountantApprovalStatus: string;
  approvedByAccountantId: string | null;
  approvedByAccountantName: string | null;
  approvedAt: string | null;
  incentiveEligible: boolean;
  remarks: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionProof {
  id: string;
  contentType: string;
  createdAt: string;
}

export interface CollectionDetail extends Collection {
  allocations: CollectionAllocation[];
  /** SE-uploaded receipt photo, or null for web-created collections. */
  proof: CollectionProof | null;
}

export interface Collector {
  id: string;
  name: string;
  roleLabel: string;
}
