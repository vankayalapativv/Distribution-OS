/** Shared types for the customer-detail screen (fully online — no cache). */

/** Header payload from GET /customers/:id — name/code/address/phone + geofence. */
export interface CustomerHeader {
  id: string;
  customerCode: string | null;
  legalName: string | null;
  customerName: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressLandmark: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Whether this SE has already checked in here today (server truth) — hydrates
   *  the visit button so it survives an app reopen. */
  visitedToday?: boolean;
  /** The id of today's visit here (for the check-out POST), or null. */
  todayVisitId?: string | null;
  /** Whether today's visit here is already checked out — locks the button to
   *  "Visited today" (no re-check-in, no re-check-out). */
  todayVisitCheckedOut?: boolean;
  /** Credit gate, folded into the header so the action row knows the blocked
   *  state at first paint (no enabled-"Order"→"Blocked" flash). Optional: an
   *  older cached header may lack it, in which case the row shows its skeleton
   *  until the invoices credit query resolves. */
  creditBlocked?: boolean;
  creditOverdueDays?: number;
  totalOutstanding?: number;
}

/** Credit/balance verdict from GET /customers/:id/invoices (subset used here). */
export interface Credit {
  creditBlocked: boolean;
  creditOverdueDays: number;
  totalOutstanding: number;
}

export interface ServerOrder {
  id: string;
  orderCode: string;
  orderDate: string;
  totalLitres: number | null;
  orderStatus: string;
  /** Computed fulfillment stage — drives the order badge (ordered → delivered). */
  fulfillmentStatus: string | null;
}

export interface ServerCollection {
  id: string;
  collectionCode: string;
  collectionDate: string;
  collectionAmount: string | number;
  paymentMode: string;
  accountantApprovalStatus: string;
}

export interface CustomerPhoto {
  id: string;
  createdAt: string;
}
