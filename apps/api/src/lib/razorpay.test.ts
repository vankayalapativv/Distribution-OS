import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  constantTimeEqual,
  createOrder,
  hmacSha256Hex,
  orderIsUsable,
  verifyOrderPaymentSignature,
  verifyWebhookSignature,
} from "./razorpay";

/** Reference HMAC via Node crypto — the lib (Web Crypto) must match this. */
const hmacHex = (secret: string, message: string) =>
  createHmac("sha256", secret).update(message).digest("hex");

const WEBHOOK_SECRET = "whsec_test_abcdef0123456789";
const KEY_SECRET = "rzp_key_secret_test_0123456789";

describe("hmacSha256Hex", () => {
  it("matches Node's HMAC-SHA256 hex", async () => {
    const body = `{"event":"payment.captured","id":"evt_123"}`;
    expect(await hmacSha256Hex(WEBHOOK_SECRET, body)).toBe(hmacHex(WEBHOOK_SECRET, body));
  });
});

describe("constantTimeEqual", () => {
  it("is true for identical strings", () => {
    expect(constantTimeEqual("a1b2c3", "a1b2c3")).toBe(true);
  });
  it("is false for differing strings of equal length", () => {
    expect(constantTimeEqual("a1b2c3", "a1b2c4")).toBe(false);
  });
  it("is false for a length mismatch", () => {
    expect(constantTimeEqual("a1b2c3", "a1b2c3d")).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const rawBody = `{"entity":"event","event":"payment.captured","payload":{}}`;

  it("accepts a correctly signed raw body", async () => {
    const sig = hmacHex(WEBHOOK_SECRET, rawBody);
    expect(await verifyWebhookSignature(rawBody, sig, WEBHOOK_SECRET)).toBe(true);
  });

  it("rejects a tampered body (signature computed over original)", async () => {
    const sig = hmacHex(WEBHOOK_SECRET, rawBody);
    const tampered = rawBody.replace("captured", "failed");
    expect(await verifyWebhookSignature(tampered, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const sig = hmacHex("the_wrong_secret", rawBody);
    expect(await verifyWebhookSignature(rawBody, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyWebhookSignature(rawBody, null, WEBHOOK_SECRET)).toBe(false);
    expect(await verifyWebhookSignature(rawBody, undefined, WEBHOOK_SECRET)).toBe(false);
  });
});

describe("verifyOrderPaymentSignature (Billing v2 one-time order)", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts the correct order_id|payment_id signature", async () => {
    const sig = hmacHex(KEY_SECRET, `${orderId}|${paymentId}`);
    expect(await verifyOrderPaymentSignature(orderId, paymentId, sig, KEY_SECRET)).toBe(true);
  });

  it("rejects a signature over swapped ids", async () => {
    const sig = hmacHex(KEY_SECRET, `${paymentId}|${orderId}`);
    expect(await verifyOrderPaymentSignature(orderId, paymentId, sig, KEY_SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong key secret", async () => {
    const sig = hmacHex("wrong_key_secret", `${orderId}|${paymentId}`);
    expect(await verifyOrderPaymentSignature(orderId, paymentId, sig, KEY_SECRET)).toBe(false);
  });

  it("rejects a missing signature", async () => {
    expect(await verifyOrderPaymentSignature(orderId, paymentId, null, KEY_SECRET)).toBe(false);
  });
});

describe("createOrder", () => {
  const env = { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "secret_x" } as never;
  afterEach(() => vi.restoreAllMocks());

  it("POSTs /orders with the amount, INR, and receipt", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "order_1", amount: 70800, currency: "INR", status: "created" }), { status: 200 }));
    await createOrder(env, { amountPaisa: 70800, receipt: "bill-2026-11", notes: { period: "2026-11-01" } });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 70800,
      currency: "INR",
      receipt: "bill-2026-11",
      notes: { period: "2026-11-01" },
    });
  });

  it("throws RAZORPAY_NOT_CONFIGURED (500) before any request when keys are missing", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(createOrder({} as never, { amountPaisa: 100, receipt: "r" })).rejects.toMatchObject({
      code: "RAZORPAY_NOT_CONFIGURED",
      status: 500,
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("orderIsUsable", () => {
  const env = { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "secret_x" } as never;
  afterEach(() => vi.restoreAllMocks());

  it("is true for an order that exists and is unpaid (created/attempted)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "order_1", status: "created" }), { status: 200 }),
    );
    expect(await orderIsUsable(env, "order_1")).toBe(true);
  });

  it("is false for an already-paid order", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "order_1", status: "paid" }), { status: 200 }),
    );
    expect(await orderIsUsable(env, "order_1")).toBe(false);
  });

  it("is false when the order is not found (e.g. keys rotated) — never throws", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { description: "The id provided does not exist" } }), { status: 400 }),
    );
    expect(await orderIsUsable(env, "order_stale")).toBe(false);
  });

  it("is false when the amount no longer matches (seat added → amount changed)", async () => {
    // Fresh Response per call — a Response body can only be read once.
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ id: "order_1", status: "created", amount: 141600 }), { status: 200 }),
    );
    // Order is for ₹1,416 but the charge is now ₹2,124 (3 seats) → not usable.
    expect(await orderIsUsable(env, "order_1", 212400)).toBe(false);
    // Same amount → usable.
    expect(await orderIsUsable(env, "order_1", 141600)).toBe(true);
  });
});
