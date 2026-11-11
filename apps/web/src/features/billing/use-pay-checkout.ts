"use client";

import { useState } from "react";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { BillingAccessV2 } from "./billing-v2-api";

type OrderPayResult = {
  orderId: string;
  amountPaisa: number;
  seats: number;
  periodStart: string;
  keyId: string | null;
};

type CheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type PayPhase = "idle" | "starting" | "confirming";

/**
 * Billing v2 Checkout — one-time monthly order. Creates/reuses the current
 * month's order (POST /billing/pay), opens Razorpay Checkout on that order,
 * confirms the signature (UI ack), then polls GET /billing/access until the
 * webhook flips the month to paid — calling `onAccess` with each fresh state so
 * the overlay closes the instant it's paid.
 */
export function usePayCheckout(
  actionConfig: ActionConfig,
  onAccess: (a: BillingAccessV2) => void,
  onPaid?: () => void,
) {
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pollUntilPaid() {
    setPhase("confirming");
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const next = await apiRequest<BillingAccessV2>(actionConfig, "GET", "/billing/access");
        onAccess(next);
        if (!next.blocked && (next.state === "active" || next.state === "free")) {
          onPaid?.(); // event-driven refresh (e.g. reload the charges history)
          break;
        }
      } catch {
        /* keep polling */
      }
    }
    setPhase("idle");
  }

  async function confirmAndPoll(resp: CheckoutResponse) {
    try {
      await apiRequest(actionConfig, "POST", "/billing/confirm", {
        razorpayOrderId: resp.razorpay_order_id,
        razorpayPaymentId: resp.razorpay_payment_id,
        razorpaySignature: resp.razorpay_signature,
      });
    } catch (e) {
      // Webhook is source of truth; a confirm hiccup shouldn't stop us.
      setError(errorMessage(e, "Could not verify the payment; waiting for confirmation…"));
    }
    await pollUntilPaid();
  }

  async function payNow(rupeesLabel: string) {
    setError(null);
    setPhase("starting");
    let order: OrderPayResult;
    try {
      order = await apiRequest<OrderPayResult>(actionConfig, "POST", "/billing/pay");
    } catch (e) {
      setPhase("idle");
      setError(errorMessage(e, "Could not start the payment."));
      return;
    }
    if (!order.keyId) {
      setPhase("idle");
      setError("Razorpay key is not configured.");
      return;
    }
    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) {
      setPhase("idle");
      setError("Could not load Razorpay Checkout. Check your connection and try again.");
      return;
    }
    // With an Order, Razorpay Checkout derives amount + currency from the order
    // itself — passing them again can conflict, so we only send order_id.
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      name: "Distribution OS",
      description: `Monthly access for ${order.seats} user(s) (${rupeesLabel})`,
      handler: (resp: CheckoutResponse) => void confirmAndPoll(resp),
      modal: { ondismiss: () => setPhase("idle") },
      theme: { color: "#2563eb" },
    });
    rzp.open();
  }

  return { phase, error, payNow };
}
