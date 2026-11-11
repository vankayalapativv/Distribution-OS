import { Hono } from "hono";
import { success } from "../lib/api-response";
import { getSqlClient } from "../lib/db";
import { verifyWebhookSignature } from "../lib/razorpay";
import { applyPaymentWebhook, type PaymentWebhookEvent } from "../services/billing-v2";
import type { ApiEnv } from "../types";

/**
 * Razorpay webhook receiver — the SOURCE OF TRUTH for Billing v2 payment state.
 *
 * Verifies HMAC-SHA256 over the RAW body against RAZORPAY_WEBHOOK_SECRET
 * (constant-time), is idempotent on x-razorpay-event-id, and always returns 2xx
 * once accepted so Razorpay doesn't needlessly retry. Mounted OUTSIDE the auth
 * role guards and exempt from the billing gate. Invalid/missing signature → 400
 * with nothing written. Only one-time order payments (payment.captured /
 * order.paid) are acted on; any other event is acknowledged and ignored.
 */
export const razorpayWebhookRoutes = new Hono<ApiEnv>().post("/razorpay", async (c) => {
  const secret = c.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "webhook not configured" }, 500);

  // Read the exact bytes received — the signature is over the raw body.
  const raw = await c.req.text();
  const signature = c.req.header("x-razorpay-signature");
  const valid = await verifyWebhookSignature(raw, signature, secret);
  if (!valid) return c.json({ error: "invalid signature" }, 400);

  const eventId = c.req.header("x-razorpay-event-id");
  if (!eventId) return c.json({ error: "missing event id" }, 400);

  let event: PaymentWebhookEvent;
  try {
    event = JSON.parse(raw) as PaymentWebhookEvent;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const sql = getSqlClient(c);
  const result = await applyPaymentWebhook(sql, eventId, event);
  // `handled: false` = an event type we don't act on (e.g. a refund) — ack it so
  // Razorpay stops retrying.
  return c.json(success(c, result));
});
