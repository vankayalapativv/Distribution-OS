import type { MiddlewareHandler } from "hono";
import { getSqlClient } from "../lib/db";
import { getBillingAccess, isBillingEnforced } from "../services/billing-v2";
import type { ApiEnv } from "../types";

/**
 * Server-side billing enforcement (Billing v2 — standard monthly payments). When
 * the current month is unpaid past its 7-day grace, app API calls are rejected
 * with HTTP 402 — the web block screen is UX, this is the real gate.
 *
 * Two-level enforcement: the global BILLING_ENFORCED env flag is the master switch
 * (and a fast short-circuit — off = zero gate work), and each enterprise opts in
 * individually via `enterprise_billing_config.billing_enforced`. An enterprise is
 * gated only when BOTH are on and its month is unpaid past grace, so demos and new
 * signups are never blocked. FAIL-OPEN: if billing can't be read (e.g. a transient
 * DB error), the request is allowed through so a hiccup never 402-bricks the app.
 * Access derives from the latest paid/free month + grace (see getBillingAccess).
 * Billing + webhook + health/status stay reachable so a blocked user can pay.
 *
 * `/onboarding/*` is exempt too: it is identity/onboarding-state, read on the
 * login-landing path (`/onboarding/me` decides where a session goes). Gating it
 * would make a blocked enterprise's `/onboarding/me` return 402, the web reads
 * that as "no_account" and logs the user out with `?error=not_registered` — so
 * they'd never reach the billing screen. For an active enterprise it returns
 * "active" → the dashboard renders BillingBlockedScreen, which is the intent.
 *
 * `/me` is NOT exempted wholesale: only the identity/authz reads the web shell
 * needs to bootstrap and render the pay screen are allowed. The data/action
 * routes under `/me` (notifications, tasks, section updates, badge counts,
 * push-token, section-seen) ARE gated, so a blocked org can't keep using them.
 */
const EXEMPT_PREFIXES = ["/webhooks", "/billing", "/health", "/status", "/onboarding"];

// Identity/status endpoints under /me that must stay reachable while blocked so
// the UI can load and show the billing dialog. Exact paths only — every other
// /me/* route falls through to the gate.
const EXEMPT_EXACT = new Set(["/me", "/me/profile", "/me/permissions", "/me/scope"]);

export const billingGate: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (!isBillingEnforced(c.env)) return await next();

  // Normalize: v1 is mounted at both "/" and "/api/v1".
  const rel = c.req.path.replace(/^\/api\/v1/, "") || "/";
  if (
    rel === "/" ||
    EXEMPT_EXACT.has(rel) ||
    EXEMPT_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`))
  ) {
    return await next();
  }

  let blocked = false;
  let reason = "ok";
  try {
    const access = await getBillingAccess(getSqlClient(c));
    // Per-enterprise opt-in: the global flag (checked above) is the master switch,
    // but an enterprise is gated only if IT has enforcement turned on. Unpriced /
    // unenforced enterprises (demos, new signups) are never blocked.
    blocked = access.blocked && (access.config?.enforced ?? false);
    reason = access.reason;
  } catch {
    // Fail-open: never brick the app because billing couldn't be read.
    return await next();
  }

  if (blocked) {
    return c.json(
      {
        success: false,
        error: { code: "BILLING_BLOCKED", message: "Monthly payment required.", reason },
        meta: { requestId: c.get("requestId") },
      },
      402,
    );
  }
  return await next();
};
