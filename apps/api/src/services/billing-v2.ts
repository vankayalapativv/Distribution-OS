import type { SqlClient } from "../lib/db";
import type { ApiEnv } from "../types";
import { createOrder, orderIsUsable } from "../lib/razorpay";
import { getSystemSettings, type CompanyProfile } from "./system-settings";

/**
 * Billing v2 — standard one-time monthly seat-based payments.
 *
 * No Razorpay mandate/subscription. Each calendar month the app generates a
 * fresh charge for ₹708 × active seats (counted at generation — the seat
 * reconcile), and the client pays it via in-app Razorpay Checkout (Orders API).
 * Access is derived from the latest paid/free month:
 *
 *   blocked  ⟺  now > (end of latest paid/free month) + 7-day grace
 *
 * See docs/BILLING-STANDARD-PAYMENT-ARCHITECTURE.md. This module holds the pure
 * money/state logic (unit-tested) plus the DB reads/writes; calendar-month math
 * is done in SQL (IST) to match the rest of the codebase (dues/targets).
 */

/** Per-seat monthly amount in paisa: ₹600 + 18% GST = ₹708 (GST-inclusive). */
export const UNIT_AMOUNT_PAISA = 70800;

/**
 * Whether server-side billing enforcement (the 402 gate + the hard block screen)
 * is active. ON by default — disable ONLY by setting the secret exactly to
 * "false" (used during onboarding/testing so the app stays fully usable).
 */
export function isBillingEnforced(env: ApiEnv["Bindings"]): boolean {
  return env.BILLING_ENFORCED !== "false";
}

/** Grace after a month's payment falls due, before the app is blocked. */
export const GRACE_DAYS = 7;

// GST invoicing is handled MANUALLY outside the app (the owner issues + sends the
// monthly invoice). The app only tracks amount/seats/paid-status — it does not
// generate invoices, so there is no invoice PDF, SAC code, or GST-split helper here.

// ── Pure money logic (unit-tested) ──────────────────────────────────────────

/** Total GST-inclusive charge in paisa for `seats` active users. */
export function chargeAmountPaisa(seats: number): number {
  return UNIT_AMOUNT_PAISA * Math.max(0, Math.trunc(seats));
}

// ── Pure access state machine (unit-tested) ─────────────────────────────────

export type BillingState = "free" | "active" | "grace" | "blocked" | "none";

export interface AccessInput {
  /** End (ms) of the latest paid/free month, or null if none yet. */
  paidThroughMs: number | null;
  /** Whether the current calendar month's charge is paid or free. */
  currentCovered: boolean;
  /** Whether the current calendar month's charge is a FREE one (vs paid). */
  currentIsFree: boolean;
  nowMs: number;
  graceDays?: number;
}

export interface AccessResult {
  blocked: boolean;
  state: BillingState;
  /** Hard cutoff (ms): paidThrough + grace. Access ends after this. */
  accessUntilMs: number | null;
  reason: string;
}

/**
 * Decide access from the latest paid/free month-end and the current month's
 * coverage. Pay-in-advance: the current month's payment is due on the 1st, and
 * the grace window covers the first `graceDays` days of the month.
 */
export function computeAccess(input: AccessInput): AccessResult {
  const graceDays = input.graceDays ?? GRACE_DAYS;
  const { paidThroughMs, nowMs, currentCovered, currentIsFree } = input;

  if (paidThroughMs === null) {
    // No free/paid period recorded at all (pre go-live) — treat as blocked so
    // enforcement is fail-closed; go-live seeds the free period.
    return { blocked: true, state: "none", accessUntilMs: null, reason: "no-billing" };
  }

  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  const accessUntilMs = paidThroughMs + graceMs;

  if (currentCovered) {
    return {
      blocked: false,
      state: currentIsFree ? "free" : "active",
      accessUntilMs,
      reason: currentIsFree ? "free-month" : "paid",
    };
  }

  // Current month not yet paid.
  if (nowMs <= accessUntilMs) {
    return { blocked: false, state: "grace", accessUntilMs, reason: "grace" };
  }
  return { blocked: true, state: "blocked", accessUntilMs, reason: "grace-expired" };
}

// ── DB reads/writes ─────────────────────────────────────────────────────────

/** Active users across ALL roles — the billed seat count. */
export async function getActiveSeatCount(sql: SqlClient): Promise<number> {
  const rows = await sql`
    /* billing_v2_seat_count */
    select count(*)::int as n from users where status = 'active'
  `;
  return Number((rows[0] as { n?: number } | undefined)?.n ?? 0);
}

export interface ChargeRow {
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

function asDateStr(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return "";
}

function mapCharge(r: Record<string, unknown>): ChargeRow {
  return {
    id: String(r.id),
    periodStart: asDateStr(r.periodStart),
    periodEnd: asDateStr(r.periodEnd),
    seats: Number(r.seats ?? 0),
    amountPaisa: Number(r.amountPaisa ?? 0),
    status: (r.status as ChargeRow["status"]) ?? "pending",
    razorpayOrderId: (r.razorpayOrderId as string | null) ?? null,
    razorpayPaymentId: (r.razorpayPaymentId as string | null) ?? null,
    paidAt: r.paidAt ? asDateStr(r.paidAt) : null,
  };
}

/** All charges, newest month first — feeds the billing-history page. */
export async function listCharges(sql: SqlClient): Promise<ChargeRow[]> {
  const rows = await sql`
    /* billing_v2_list_charges */
    select id, period_start as "periodStart", period_end as "periodEnd",
           seats, amount_paisa as "amountPaisa", status,
           razorpay_order_id as "razorpayOrderId", razorpay_payment_id as "razorpayPaymentId",
           to_char(paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as "paidAt"
    from billing_charges
    order by period_start desc
  `;
  return (rows as Record<string, unknown>[]).map(mapCharge);
}

export interface ReceiptData {
  charge: ChargeRow;
  /** Intra-state GST split of the paid amount (9% CGST + 9% SGST), in paisa. */
  gst: { taxablePaisa: number; cgstPaisa: number; sgstPaisa: number };
  /** Supplier identity for the receipt header (from the company profile). */
  company: CompanyProfile;
}

/**
 * Data for a PAID month's payment receipt (a simple acknowledgment — the formal
 * GST tax invoice is issued manually, separately). Returns null when the charge
 * doesn't exist or isn't paid. The GST split (intra-state 9% + 9%) is derived
 * from the GST-inclusive amount for display only.
 */
export async function getReceipt(sql: SqlClient, chargeId: string): Promise<ReceiptData | null> {
  const [row] = (await sql`
    /* billing_v2_receipt */
    select id, period_start as "periodStart", period_end as "periodEnd",
           seats, amount_paisa as "amountPaisa", status,
           razorpay_order_id as "razorpayOrderId", razorpay_payment_id as "razorpayPaymentId",
           to_char(paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as "paidAt"
    from billing_charges where id = ${chargeId}::uuid and status = 'paid'
  `) as Record<string, unknown>[];
  if (!row) return null;

  const charge = mapCharge(row);
  const total = charge.amountPaisa;
  const taxablePaisa = Math.round(total / 1.18);
  const gstTotal = total - taxablePaisa;
  const sgstPaisa = Math.floor(gstTotal / 2);
  const cgstPaisa = gstTotal - sgstPaisa;

  const settings = await getSystemSettings(sql);
  return {
    charge,
    gst: { taxablePaisa, cgstPaisa, sgstPaisa },
    company: settings.company,
  };
}

const GO_LIVE_KEY = "billing_go_live_date";

/** End (ms) of the given IST calendar date — i.e. that day at 23:59:59.999 IST. */
function istEndOfDayMs(dateStr: string): number {
  const startIST = Date.parse(`${dateStr}T00:00:00+05:30`);
  return startIST + 24 * 60 * 60 * 1000 - 1;
}

/**
 * Record the go-live date on first use. Seeds NO charges — billing months are
 * either created by the monthly cron (ensureCurrentCharge, as PENDING) or set up
 * directly in the DB (e.g. a month with status 'free'). There is deliberately no
 * "free first month" logic in the app: to grant a free month, set that month's
 * billing_charges row to status = 'free' in the DB. Idempotent.
 */
export async function ensureGoLive(sql: SqlClient): Promise<void> {
  await sql`
    /* billing_v2_go_live_set */
    insert into system_settings (key, value)
    values (${GO_LIVE_KEY}, to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD'))
    on conflict (key) do nothing
  `;
}

/**
 * Recompute the CURRENT month's charge to the live active-seat count — but only
 * while it is still PENDING (unpaid). Adding/removing a user before the month is
 * paid updates the amount to ₹708 × current active users, so the banner, billing
 * page and Pay button all reflect reality. A PAID month is never touched (extra
 * users bill next cycle). If the amount changes, any stored Razorpay order is
 * cleared so the next Pay creates a fresh order for the new amount. No-op (no
 * write) when the seat count already matches.
 */
export async function syncPendingCharge(sql: SqlClient): Promise<void> {
  await sql`
    /* billing_v2_sync_pending */
    with cur as (
      select date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart
    ),
    seats as (select count(*)::int as n from users where status = 'active')
    update billing_charges c
       set seats = s.n,
           amount_paisa = s.n * ${UNIT_AMOUNT_PAISA},
           razorpay_order_id = case when c.amount_paisa <> s.n * ${UNIT_AMOUNT_PAISA}
                                    then null else c.razorpay_order_id end
      from cur, seats s
     where c.period_start = cur.mstart
       and c.status = 'pending'
       and c.seats <> s.n
  `;
}

interface AccessQueryRow {
  paidThrough: unknown;
  currentStatus: string | null;
  currentStart: unknown;
  currentEnd: unknown;
}

export interface BillingAccess extends AccessResult {
  /** The current calendar month's charge, if any (drives the Pay button). */
  current: ChargeRow | null;
  /** ISO end-of-access for display, or null. */
  accessUntilIso: string | null;
}

/**
 * Compute the org's current billing access. Self-seeds go-live on first call so
 * the gate/overlay always have a defined state. Calendar-month math is done in
 * SQL (IST); the grace/state decision is the pure `computeAccess`.
 */
export async function getBillingAccess(sql: SqlClient): Promise<BillingAccess> {
  // Ensure the CURRENT month has a charge to pay (idempotent). Done here, not
  // only in the cron, so the amount + Pay button appear immediately — locally
  // (wrangler dev never fires scheduled crons) and on prod regardless of when
  // the cron last ran. A month pre-seeded as 'free' in the DB is left untouched.
  await ensureCurrentCharge(sql);
  // Keep an unpaid current month in step with the live active-seat count.
  await syncPendingCharge(sql);

  const [row] = (await sql`
    /* billing_v2_access */
    with cur as (
      select date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart,
             (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) + interval '1 month' - interval '1 day')::date as mend
    )
    select
      (select max(period_end) from billing_charges where status in ('paid','free')) as "paidThrough",
      (select status from billing_charges c, cur where c.period_start = cur.mstart) as "currentStatus",
      cur.mstart as "currentStart",
      cur.mend   as "currentEnd"
    from cur
  `) as unknown as [AccessQueryRow];

  const paidThroughStr = asDateStr(row.paidThrough);
  const paidThroughMs = paidThroughStr ? istEndOfDayMs(paidThroughStr) : null;
  const currentStatus = row.currentStatus;
  const currentCovered = currentStatus === "paid" || currentStatus === "free";
  const currentIsFree = currentStatus === "free";
  const nowMs = Date.now();

  const access = computeAccess({ paidThroughMs, currentCovered, currentIsFree, nowMs });

  // The current month's full charge row (for the Pay button / amount).
  const curStart = asDateStr(row.currentStart);
  const current = curStart
    ? ((await sql`
        /* billing_v2_current_charge */
        select id, period_start as "periodStart", period_end as "periodEnd",
               seats, amount_paisa as "amountPaisa", status,
               razorpay_order_id as "razorpayOrderId", razorpay_payment_id as "razorpayPaymentId",
               to_char(paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as "paidAt"
        from billing_charges where period_start = ${curStart}
      `) as Record<string, unknown>[])
    : [];

  return {
    ...access,
    accessUntilIso: access.accessUntilMs ? new Date(access.accessUntilMs).toISOString() : null,
    current: current.length > 0 ? mapCharge(current[0]) : null,
  };
}

/**
 * Ensure the CURRENT calendar month has a charge row. Called by the cron near
 * month start. If the month is already seeded (free or otherwise) or already has
 * a row, nothing happens. Otherwise it inserts a pending charge for ₹708 ×
 * current active seats (the seat reconcile). The Razorpay order is created
 * lazily on the Pay click (ensureOrderForCharge), so the cron makes no Razorpay
 * calls — `env` is kept for signature symmetry with the other maintenance fns.
 */
export async function ensureCurrentCharge(
  sql: SqlClient,
  _env?: ApiEnv["Bindings"],
): Promise<{ created: boolean; chargeId?: string }> {
  await ensureGoLive(sql);

  const [existing] = (await sql`
    /* billing_v2_current_exists */
    select c.id
    from billing_charges c
    where c.period_start = date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date
  `) as Record<string, unknown>[];
  if (existing) return { created: false };

  const seats = await getActiveSeatCount(sql);
  const amountPaisa = chargeAmountPaisa(seats);

  const [row] = (await sql`
    /* billing_v2_insert_pending */
    insert into billing_charges (period_start, period_end, seats, amount_paisa, status)
    select date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date,
           (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) + interval '1 month' - interval '1 day')::date,
           ${seats}, ${amountPaisa}, 'pending'
    on conflict (period_start) do nothing
    returning id, period_start as "periodStart"
  `) as Record<string, unknown>[];
  if (!row) return { created: false }; // raced with another run

  return { created: true, chargeId: String(row.id) };
}

/**
 * Ensure a pending charge has a VALID Razorpay order to pay against, creating one
 * if missing — or regenerating it if the stored order is no longer usable (e.g.
 * the API keys were rotated, so the old order belongs to a different account and
 * Checkout would fail with "order not found"). Returns the order id. Safe to call
 * from the Pay endpoint.
 */
export async function ensureOrderForCharge(
  sql: SqlClient,
  env: ApiEnv["Bindings"],
  chargeId: string,
): Promise<string | null> {
  const [row] = (await sql`
    /* billing_v2_charge_for_order */
    select id, period_start as "periodStart", amount_paisa as "amountPaisa",
           status, razorpay_order_id as "razorpayOrderId"
    from billing_charges where id = ${chargeId}::uuid
  `) as Record<string, unknown>[];
  if (row?.status !== "pending") return (row?.razorpayOrderId as string | null) ?? null;

  // Reuse the stored order only if it's still valid for the CURRENT keys AND
  // still charges the right amount (a seat change may have moved the amount).
  const stored = row.razorpayOrderId as string | null;
  if (stored && (await orderIsUsable(env, stored, Number(row.amountPaisa)))) return stored;

  const receipt = `bill-${asDateStr(row.periodStart).slice(0, 7)}`; // bill-YYYY-MM
  const order = await createOrder(env, {
    amountPaisa: Number(row.amountPaisa),
    receipt,
    notes: { kind: "seat-billing", period: asDateStr(row.periodStart) },
  });

  // Overwrite even a stale/invalid order id (regeneration), scoped to this charge
  // while it's still pending so a concurrent payment can't be clobbered.
  await sql`
    /* billing_v2_set_order */
    update billing_charges set razorpay_order_id = ${order.id}
    where id = ${chargeId}::uuid and status = 'pending'
  `;
  return order.id;
}

/** Razorpay events that settle a one-time order payment (Billing v2). */
export const PAYMENT_EVENTS = new Set(["payment.captured", "order.paid"]);

/** Minimal shape of the payment/order webhook payloads we read. */
export interface PaymentWebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; created_at?: number } };
    order?: { entity?: { id?: string } };
  };
}

/**
 * Apply a one-time payment webhook (Billing v2). Idempotent on the event id;
 * marks the charge behind the order paid. Returns `handled: false` for events
 * that aren't payment settlements (so the caller can fall through to the legacy
 * subscription handler during the transition).
 */
export async function applyPaymentWebhook(
  sql: SqlClient,
  eventId: string,
  event: PaymentWebhookEvent,
): Promise<{ handled: boolean; paid: boolean; chargeId?: string }> {
  if (!PAYMENT_EVENTS.has(event.event)) return { handled: false, paid: false };

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id ?? event.payload?.order?.entity?.id ?? null;
  const paymentId = payment?.id ?? null;

  // Record the idempotency event id once. Kept as the first statement of the
  // settlement transaction below so the marker and the paid-flip commit together.
  const recordEvent = sql`
    /* billing_v2_event_once */
    insert into billing_payment_events (event_id, kind)
    values (${eventId}, ${event.event})
    on conflict (event_id) do nothing
    returning event_id
  `;

  // Nothing to settle (no order/payment id on the payload): still record the
  // event so it isn't reprocessed, but there's no charge to flip.
  if (!orderId || !paymentId) {
    await sql.transaction([recordEvent]);
    return { handled: true, paid: false };
  }

  const paidAt = new Date(payment?.created_at ? payment.created_at * 1000 : Date.now()).toISOString();
  // Atomic settlement: record the event AND flip the charge in one transaction,
  // so the idempotency marker is committed only if the paid-flip commits too.
  // (Previously these were two separate auto-committed statements: a crash
  // between them let Razorpay's redelivery be deduped by the already-committed
  // event while the charge stayed pending — leaving a paying client blocked.)
  // The flip is idempotent (`status = 'pending'` guard), so re-running it on a
  // duplicate delivery is a harmless no-op and self-heals a legacy stuck charge.
  const results = (await sql.transaction([
    recordEvent,
    sql`
      /* billing_v2_mark_paid */
      update billing_charges
         set status = 'paid', razorpay_payment_id = ${paymentId}, paid_at = ${paidAt}
       where razorpay_order_id = ${orderId} and status = 'pending'
      returning id
    `,
  ])) as unknown as Record<string, unknown>[][];
  const charge = results[1]?.[0];
  return { handled: true, paid: Boolean(charge), chargeId: charge ? String(charge.id) : undefined };
}
