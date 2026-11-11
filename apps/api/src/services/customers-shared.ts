/**
 * Shared foundation for the customers service (architecture audit G-0104): the
 * customer context + SE-visibility rule, value helpers, row mapper, and shared
 * types/constants used across the customers read, write, and ledger paths. Split
 * out of the former 1603-line customers.ts. Depends on nothing in customers.ts,
 * so no import cycle.
 */
import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import type { Role } from "../types";

export interface CustomerContext {
  userId: string;
  role?: Role | null;
}

/**
 * SE visibility rule (decided 2026-07-10): a SALES_EXECUTIVE sees ONLY the
 * customers they created; SUPER_ADMIN / MANAGER / ACCOUNTANT see all.
 * Returns the created_by filter value: the SE's id, or null (= no filter).
 */
export function creatorScope(context: CustomerContext): string | null {
  return context.role === "SALES_EXECUTIVE" ? context.userId : null;
}

/**
 * 404s when the customer doesn't exist OR isn't visible to the caller —
 * "not yours" is indistinguishable from "doesn't exist" on purpose.
 */
export async function assertCustomerVisible(
  sql: SqlClient,
  context: CustomerContext,
  customerId: string,
): Promise<void> {
  const scope = creatorScope(context);
  const rows = await sql`
    /* assert_customer_visible */
    select id from customers
    where id = ${customerId}::uuid
      and (${scope}::uuid is null or created_by = ${scope}::uuid)
  `;
  if (rows.length === 0) {
    throw new ApiError("NOT_FOUND", "Customer not found.", 404);
  }
}

export interface CreateCustomerInput {
  legalName: string;
  tradeName: string | null;
  customerName: string | null;
  customerType: string;
  segment: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone: string | null;
  alternativePhone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadharNumber: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPincode: string | null;
  addressLandmark: string | null;
  email: string | null;
  customerGrade: string | null;
  creditLimit: number | null;
  creditDays: number | null;
  /** The owning sales executive (customers.created_by). Falls back to the creator. */
  salesExecutiveId?: string | null;
  /** Idempotency key for offline/retry-safe creation: a repeat POST with the same
   *  clientUuid returns the already-created customer instead of a duplicate/409. */
  clientUuid?: string | null;
}

export interface UpdateCustomerInput {
  legalName: string | null;
  tradeName: string | null;
  customerName: string | null;
  customerType: string | null;
  segment: string | null;
  phone: string | null;
  alternativePhone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadharNumber: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPincode: string | null;
  addressLandmark: string | null;
  email: string | null;
  customerGrade: string | null;
  creditLimit: number | null;
  creditDays: number | null;
}

export interface ListCustomersFilters {
  status?: string | null;
  customerGrade?: string | null;
  search?: string | null;
  since?: string | null;
}

export type Row = Record<string, unknown>;

export const VALID_STATUSES = new Set(["active", "inactive", "suspended"]);
export const VALID_CUSTOMER_TYPES = new Set(["mechanic", "retail", "lof", "industrial"]);

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

// Neon returns PostgreSQL date columns as JS Date objects.
export function dateStringValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : "";
}

export function nullableNumberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return null;
}

export function mapCustomerRow(row: Row) {
  return {
    id: stringValue(row.id),
    customerCode: stringValue(row.customerCode),
    legalName: stringValue(row.legalName),
    tradeName: nullableStringValue(row.tradeName),
    customerName: nullableStringValue(row.customerName),
    customerType: stringValue(row.customerType),
    segment: nullableStringValue(row.segment),
    phone: nullableStringValue(row.phone),
    alternativePhone: nullableStringValue(row.alternativePhone),
    gstNumber: nullableStringValue(row.gstNumber),
    panNumber: nullableStringValue(row.panNumber),
    aadharNumber: nullableStringValue(row.aadharNumber),
    addressStreet: nullableStringValue(row.addressStreet),
    addressCity: nullableStringValue(row.addressCity),
    addressState: nullableStringValue(row.addressState),
    addressPincode: nullableStringValue(row.addressPincode),
    addressLandmark: nullableStringValue(row.addressLandmark),
    email: nullableStringValue(row.email),
    customerGrade: nullableStringValue(row.customerGrade),
    creditLimit: numberValue(row.creditLimit),
    creditDays: numberValue(row.creditDays),
    paymentStatus: stringValue(row.paymentStatus),
    kycStatus: stringValue(row.kycStatus),
    approvalStatus: stringValue(row.approvalStatus),
    status: stringValue(row.status),
    createdBy: nullableStringValue(row.createdBy),
    salesExecutiveName: nullableStringValue(row.salesExecutiveName),
    latitude: nullableNumberValue(row.latitude),
    longitude: nullableNumberValue(row.longitude),
    // True only on the customer-detail path (getCustomerById), which computes it
    // per requesting user; absent on list rows → false.
    visitedToday: row.visitedToday === true,
    // Today's visit id + whether it's been checked out — drives the mobile
    // 3-state button (Check in → Check out → Visited today). Null on list rows.
    todayVisitId: nullableStringValue(row.todayVisitId),
    todayVisitCheckedOut: row.todayVisitCheckedOut === true,
  };
}
