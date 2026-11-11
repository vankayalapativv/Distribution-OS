/** Submit-order state machine — online-first with an offline queue fallback.
 *  Tries the server; offline it records the order to the local outbox (orders +
 *  order_items + a queued write) and confirms a "saved, will sync" state. Tracks
 *  spinner + error, and holds the confirmed order code. */
import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { submitOrder } from "./api";
import { recordOrder } from "./order-queue";
import { istDate } from "../day-flag";
import { getLocalDb } from "../db";
import { submitWrite } from "../online-first";
import { kickSync } from "../sync";
import type { OrderCart } from "./use-order-cart";

export function useOrderSubmit(
  customerId: string | undefined,
  token: string | null,
  cart: OrderCart,
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderCode: string; queued?: boolean } | null>(null);
  // One stable idempotency key per order attempt — reused on every retry so a
  // timed-out-but-succeeded POST replays server-side (existing:true) instead of
  // creating a duplicate order. Minted lazily; cleared by reset() for the next order.
  const clientUuid = useRef<string | null>(null);
  // Guard setState if the SE backs out of the screen mid-submit.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function submit() {
    if (!customerId || !cart.canSubmit || submitting) return;
    if (!clientUuid.current) clientUuid.current = Crypto.randomUUID();
    setSubmitting(true);
    setError(null);
    // IST calendar date (not UTC) — an order placed after IST midnight must land
    // on today's business day, or it drops out of the "today" dashboard.
    const orderDate = istDate();
    const uuid = clientUuid.current;
    const payload = { customerId, orderDate, items: cart.items, clientUuid: uuid };
    try {
      // Online-first: try the server; offline, record to the local outbox and
      // queue the write (idempotent via clientUuid).
      const outcome = await submitWrite<{ orderCode: string; existing?: boolean }>({
        send: () => submitOrder(token, payload),
        queue: () => {
          const db = getLocalDb();
          if (!db) throw new Error("no local db"); // → submitWrite reports "unsaved"
          recordOrder(db, { clientUuid: uuid, customerId, orderDate, items: cart.items }, Date.now());
        },
      });
      if (!mounted.current) return;
      if (outcome.status === "sent") {
        setResult({ orderCode: outcome.data.orderCode });
      } else if (outcome.status === "queued") {
        void kickSync(); // best-effort immediate flush attempt
        setResult({ orderCode: "", queued: true });
      } else {
        setError(
          outcome.status === "unsaved"
            ? "Couldn't save the order on this device. Please try again."
            : "The server rejected this order. Please review and try again.",
        );
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Could not place the order. Please try again.");
      }
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  function reset() {
    clientUuid.current = null; // next order gets a fresh idempotency key
    setResult(null);
    setError(null);
  }

  return { submit, submitting, error, result, reset };
}
