import "server-only";

import { getApiAuthHeaders, requireAuthToken } from "@/features/auth/server-session";
import { serverApiFetch } from "@/lib/server-api";
import type { ActionConfig } from "@/lib/api-client";
import type { BillingConfigV2 } from "./billing-format";

/** One monthly charge (mirror of the API's billing_charges row). */
export interface BillingChargeV2 {
  id: string;
  periodStart: string; // YYYY-MM-DD (1st)
  periodEnd: string; // YYYY-MM-DD (last day)
  seats: number;
  amountPaisa: number;
  status: "free" | "pending" | "paid" | "void";
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
}

export type BillingStateV2 = "free" | "active" | "grace" | "blocked" | "none";

/** Response of GET /billing/access — drives the overlay + billing page. */
export interface BillingAccessV2 {
  blocked: boolean;
  state: BillingStateV2;
  reason: string;
  accessUntilMs: number | null;
  accessUntilIso: string | null;
  /** The current calendar month's charge (drives the Pay button), or null. */
  current: BillingChargeV2 | null;
  /** True when the signed-in user's role may pay (web roles only). */
  canPay: boolean;
  /** True when the signed-in user is SUPER_ADMIN. */
  isAdmin: boolean;
  /** Whether server-side enforcement is on — the UI hard-blocks only when true. */
  enforced: boolean;
  /** Public Razorpay key id for opening Checkout. */
  keyId: string | null;
  /** This enterprise's price (model + amount + GST), or null if unpriced. */
  config: BillingConfigV2 | null;
}

/** Payment-receipt data for a paid month (from GET /billing/receipt/:id). */
export interface BillingReceiptV2 {
  charge: BillingChargeV2;
  gst: { taxablePaisa: number; cgstPaisa: number; sgstPaisa: number };
  company: {
    legalName: string;
    gstin: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
  };
  /** This enterprise's price (model + rate), for the receipt line description. */
  config: BillingConfigV2 | null;
}

function getApiBaseUrl(): string {
  return process.env.SRI_APARAJITA_API_BASE_URL ?? "http://localhost:8787/api/v1";
}

/** Server-side fetch of a paid month's receipt; null if not found / not paid. */
export async function loadReceipt(id: string): Promise<BillingReceiptV2 | null> {
  try {
    const res = await serverApiFetch(`/billing/receipt/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: await getApiAuthHeaders(),
    });
    if (res.ok) return ((await res.json()) as { data: BillingReceiptV2 }).data;
  } catch {
    /* fall through to null */
  }
  return null;
}

/**
 * Server-side read of the org's billing access for the dashboard layout. Returns
 * null if the API call fails (e.g. migration not yet applied) so the app keeps
 * rendering — the overlay only shows on a definite `blocked`/`grace` state.
 */
export async function loadBillingAccess(): Promise<{
  access: BillingAccessV2 | null;
  actionConfig: ActionConfig;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await requireAuthToken();
  let access: BillingAccessV2 | null = null;
  try {
    const res = await serverApiFetch("/billing/access", { cache: "no-store", headers: await getApiAuthHeaders() });
    if (res.ok) access = ((await res.json()) as { data: BillingAccessV2 }).data;
  } catch {
    /* keep null — don't brick the app if billing can't be read */
  }
  return { access, actionConfig: { apiBaseUrl, authToken } };
}
