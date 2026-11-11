import { ApiError } from "./errors";
import type { ApiEnv } from "../types";

/**
 * Razorpay Subscriptions client + signature helpers for Cloudflare Workers.
 *
 * Uses the REST API via `fetch` + Web Crypto (HMAC-SHA256) only — NOT the
 * `razorpay` npm SDK (Node-only). Amounts are paisa integers. The webhook is
 * the source of truth for subscription state; these helpers verify authenticity
 * (webhook + checkout signatures) and wrap the subscription REST endpoints.
 */

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

type RazorpayBindings = Pick<
  NonNullable<ApiEnv["Bindings"]>,
  "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET" | "RAZORPAY_WEBHOOK_SECRET"
>;

const encoder = new TextEncoder();

/** HMAC-SHA256(message) with `secret`, lowercase hex — the format Razorpay uses. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string compare. Returns false fast on a length mismatch (hex
 * signatures are fixed length, so this leaks nothing useful), otherwise XORs
 * every byte so the timing doesn't depend on where the first difference is.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i += 1) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Verify a Razorpay webhook: HMAC-SHA256 over the RAW request body against the
 * webhook secret, constant-time compared to the `x-razorpay-signature` header.
 * Pass the exact bytes received (never a re-serialized object).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  webhookSecret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return constantTimeEqual(expected, signature);
}

/**
 * Verify a Checkout success for a ONE-TIME order payment (Billing v2): HMAC-SHA256
 * of `${order_id}|${payment_id}` with the KEY SECRET, compared to the
 * `razorpay_signature` Checkout returns. (Distinct from the subscription form
 * above, which signs `payment_id|subscription_id`.)
 */
export async function verifyOrderPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string | null | undefined,
  keySecret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return constantTimeEqual(expected, signature);
}

function basicAuth(env: RazorpayBindings): string {
  const id = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new ApiError("RAZORPAY_NOT_CONFIGURED", "Razorpay keys are not configured.", 500);
  }
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

interface RazorpayErrorBody {
  error?: { code?: string; description?: string };
}

async function razorpayRequest<T>(
  env: RazorpayBindings,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method,
    headers: {
      authorization: basicAuth(env),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as T & RazorpayErrorBody;
  if (!res.ok) {
    // Frame the payment provider's own reason so it reads as a clear, attributed
    // message (never a bare cryptic string or a generic "unexpected error").
    const reason = json?.error?.description?.trim() || `the request failed (HTTP ${res.status})`;
    throw new ApiError("RAZORPAY_ERROR", `The payment provider (Razorpay) declined this: ${reason}`, 503);
  }
  return json as T;
}

/** Subset of Razorpay's order entity we persist / act on (Billing v2). */
export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string | null;
}

/** Create a one-time Order (Billing v2), paid via in-app Checkout. `amountPaisa`
 *  is the GST-inclusive monthly total (₹708 × seats). No mandate is created. */
export async function createOrder(
  env: RazorpayBindings,
  params: { amountPaisa: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>(env, "POST", "/orders", {
    amount: params.amountPaisa,
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes ?? {},
  });
}

/**
 * Whether a stored order is still USABLE for a new Checkout with the CURRENT
 * keys: it exists (belongs to this account), hasn't already been paid, and — when
 * `expectedAmountPaisa` is given — still charges the right amount. Returns false
 * if Razorpay can't find it (e.g. keys rotated → order belongs to another
 * account) or the amount no longer matches (e.g. a seat was added so the month's
 * charge changed) — the caller then regenerates it. Never throws: any error ⇒
 * treat as unusable and recreate.
 */
export async function orderIsUsable(
  env: RazorpayBindings,
  orderId: string,
  expectedAmountPaisa?: number,
): Promise<boolean> {
  try {
    const order = await razorpayRequest<RazorpayOrder>(env, "GET", `/orders/${orderId}`);
    if (order.status !== "created" && order.status !== "attempted") return false;
    if (expectedAmountPaisa != null && order.amount !== expectedAmountPaisa) return false;
    return true;
  } catch {
    return false;
  }
}
