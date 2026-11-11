/**
 * Shared foundation for the collections service (architecture audit G-0104): the
 * context, value helpers, row mappers, shared types and list SQL fragments used
 * across the collections read, write and reconciliation paths. Split out of the
 * former 1039-line collections.ts. Depends on nothing in collections.ts, so no
 * import cycle.
 */

export interface CollectionContext {
  userId: string;
}

export interface CreateCollectionInput {
  customerId: string;
  collectionDate: string;
  paymentMode: string;
  /** 'general' (settle dues) or 'advance' (customer paying ahead). */
  collectionType: string;
  collectionAmount: number;
  paymentReferenceNumber: string | null;
  chequeDate: string | null;
  bankName: string | null;
  remarks: string | null;
  clientUuid?: string | null;
  /** Optional single-invoice allocation (mobile S7 flow). */
  invoiceId?: string | null;
  /**
   * The user who actually collected the money (the field SE), as opposed to the
   * web user entering it. Stored as `collected_by_user_id`. Falls back to the
   * creator when omitted (mobile SE flow, where collector == creator).
   */
  collectedByUserId?: string | null;
}

export interface ListCollectionsFilters {
  status?: string | null;
  customerId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  /** SE scoping: restrict to collections recorded by this user. */
  collectedBy?: string | null;
}

export interface PagedCollectionsParams {
  status?: string | null;
  search?: string | null;
  customerId?: string | null;
  collectedBy?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export type Row = Record<string, unknown>;

export function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

export function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

export function numStr(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return "0";
}

export function bool(v: unknown): boolean {
  return v === true || v === "true";
}

export function mapCollectionRow(row: Row) {
  return {
    id: str(row.id),
    collectionCode: str(row.collectionCode),
    collectionDate: str(row.collectionDate),
    customerId: str(row.customerId),
    customerName: strOrNull(row.customerName),
    customerCity: strOrNull(row.customerCity),
    customerPhone: strOrNull(row.customerPhone),
    collectedByUserId: str(row.collectedByUserId),
    collectedByName: strOrNull(row.collectedByName),
    paymentMode: str(row.paymentMode),
    collectionType: str(row.collectionType) || "general",
    paymentReferenceNumber: strOrNull(row.paymentReferenceNumber),
    collectionAmount: numStr(row.collectionAmount),
    chequeDate: strOrNull(row.chequeDate),
    chequeStatus: strOrNull(row.chequeStatus),
    bankName: strOrNull(row.bankName),
    matchedStatus: str(row.matchedStatus),
    accountantApprovalStatus: str(row.accountantApprovalStatus),
    approvedByAccountantId: strOrNull(row.approvedByAccountantId),
    approvedByAccountantName: strOrNull(row.approvedByAccountantName),
    approvedAt: strOrNull(row.approvedAt),
    incentiveEligible: bool(row.incentiveEligible),
    remarks: strOrNull(row.remarks),
    createdBy: strOrNull(row.createdBy),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
    clientUuid: strOrNull(row.clientUuid),
  };
}

export function mapAllocationRow(row: Row) {
  const isOpening = row.openingBalanceId != null;
  return {
    id: str(row.id),
    collectionId: str(row.collectionId),
    invoiceId: str(row.invoiceId),
    // Opening-balance allocations have no invoice — label them for the UI.
    invoiceNumber: isOpening ? "Opening Balance" : str(row.invoiceNumber),
    allocatedAmount: numStr(row.allocatedAmount),
  };
}

export const COLLECTION_LIST_COLUMNS = `
  c.id,
  c.collection_code as "collectionCode",
  c.collection_date as "collectionDate",
  c.customer_id as "customerId",
  cu.legal_name as "customerName",
  cu.address_city as "customerCity",
  cu.phone as "customerPhone",
  c.collected_by_user_id as "collectedByUserId",
  u.name as "collectedByName",
  c.payment_mode as "paymentMode",
  c.collection_type as "collectionType",
  c.payment_reference_number as "paymentReferenceNumber",
  c.collection_amount as "collectionAmount",
  c.cheque_date as "chequeDate",
  c.cheque_status as "chequeStatus",
  c.bank_name as "bankName",
  c.matched_status as "matchedStatus",
  c.accountant_approval_status as "accountantApprovalStatus",
  c.approved_by_accountant_id as "approvedByAccountantId",
  c.approved_at as "approvedAt",
  c.incentive_eligible as "incentiveEligible",
  c.remarks,
  c.created_by as "createdBy",
  c.created_at as "createdAt",
  c.updated_at as "updatedAt",
  c.client_uuid as "clientUuid"`;

export const COLLECTION_FROM = `
  from collections c
  left join customers cu on cu.id = c.customer_id
  left join users u on u.id = c.collected_by_user_id`;

export const COLLECTION_SORTS: Record<string, string> = {
  collectionCode: "c.collection_code",
  collectionDate: "c.collection_date",
  customerName: "cu.legal_name",
  collectionAmount: "c.collection_amount",
  accountantApprovalStatus: "c.accountant_approval_status",
  createdAt: "c.created_at",
};
