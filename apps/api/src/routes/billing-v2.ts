import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject, requiredString } from "../lib/request-body";
import { verifyOrderPaymentSignature } from "../lib/razorpay";
import {
  ensureOrderForCharge,
  getBillingAccess,
  getReceipt,
  isBillingEnforced,
  listCharges,
} from "../services/billing-v2";
import type { ApiEnv } from "../types";

/** Web roles that may pay the monthly bill (mobile field roles never pay). */
const PAYING_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

/**
 * Billing v2 — standard monthly seat-based payments (one-time Razorpay Orders,
 * no mandate). `GET /access` is readable by any authenticated user (drives the
 * overlay/banner). Paying + history are for web roles. The webhook remains the
 * source of truth for "paid"; `/confirm` only acknowledges the Checkout response
 * for instant UI. All /billing routes are exempt from the 402 gate so a blocked
 * user can still reach them to pay.
 */
export const billingV2Routes = new Hono<ApiEnv>()
  .get("/access", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const access = await getBillingAccess(sql);
    const canPay = (PAYING_ROLES as readonly string[]).includes(auth.role ?? "");
    return c.json(
      success(c, {
        ...access,
        canPay,
        isAdmin: auth.role === "SUPER_ADMIN",
        // Effective enforcement for THIS enterprise — the global master switch AND
        // the enterprise's own opt-in. The UI hard-blocks only when this is true.
        enforced: isBillingEnforced(c.env) && (access.config?.enforced ?? false),
        // Public Razorpay key id — safe for the browser to open Checkout with.
        keyId: c.env.RAZORPAY_KEY_ID ?? null,
      }),
    );
  })
  .get("/charges", async (c) => {
    requireRole(c, [...PAYING_ROLES]);
    const items = await listCharges(getSqlClient(c));
    return c.json(success(c, { items }));
  })
  .get("/receipt/:id", async (c) => {
    // Payment receipt for a PAID month (simple acknowledgment; the GST tax
    // invoice is issued separately/manually). Web roles only. 404 if not paid.
    requireRole(c, [...PAYING_ROLES]);
    const data = await getReceipt(getSqlClient(c), c.req.param("id"));
    if (!data) throw new ApiError("NOT_FOUND", "Receipt not found.", 404);
    return c.json(success(c, data));
  })
  .post("/pay", async (c) => {
    // Create (or reuse) the Razorpay order for the CURRENT month's pending charge
    // and hand the browser what it needs to open Checkout. Any web role can pay.
    requireRole(c, [...PAYING_ROLES]);
    const sql = getSqlClient(c);
    const access = await getBillingAccess(sql);
    const charge = access.current;
    if (!charge || charge.status !== "pending") {
      throw new ApiError("NOTHING_DUE", "There is no payment due for this month.", 409);
    }
    const orderId = await ensureOrderForCharge(sql, c.env, charge.id);
    if (!orderId) throw new ApiError("ORDER_FAILED", "Could not start the payment. Please try again.", 503);
    return c.json(
      success(c, {
        orderId,
        amountPaisa: charge.amountPaisa,
        seats: charge.seats,
        periodStart: charge.periodStart,
        keyId: c.env.RAZORPAY_KEY_ID ?? null,
      }),
    );
  })
  .post("/confirm", async (c) => {
    // UI-only acknowledgement of a successful Checkout: verify the signature so the
    // page can show "paid" immediately. The webhook does the authoritative flip +
    // invoice. No role gate beyond auth — the signature is the proof.
    requireAuth(c);
    const body = await readJsonObject(c);
    const orderId = requiredString(body, "razorpayOrderId");
    const paymentId = requiredString(body, "razorpayPaymentId");
    const signature = requiredString(body, "razorpaySignature");
    const keySecret = c.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new ApiError("RAZORPAY_NOT_CONFIGURED", "Razorpay is not configured.", 500);

    const verified = await verifyOrderPaymentSignature(orderId, paymentId, signature, keySecret);
    if (!verified) throw new ApiError("CHECKOUT_SIGNATURE_INVALID", "Checkout signature verification failed.", 400);
    return c.json(success(c, { verified: true }));
  });
