import type { R2Bucket } from "@cloudflare/workers-types";
import type { Role } from "@sri-aparajita/shared";

// Role codes are defined once in @sri-aparajita/shared and re-exported here so the
// ~64 existing `import { Role } from "../types"` sites keep working (audit G-0102/G-0103).
export type { Role };

export interface AuthContext {
  email: string | null;
  externalUserId: string | null;
  isAuthenticated: boolean;
  isProviderAdmin: boolean;
  userId: string | null;
  role: Role | null;
  source: "jwt" | "missing";
}

export interface ApiEnv {
  Bindings: {
    ENVIRONMENT?: string;
    API_VERSION?: string;
    DATABASE_URL?: string;
    /** Neon Managed Better Auth: JWKS endpoint for verifying EdDSA access tokens. */
    NEON_JWKS_URL?: string;
    /** Neon Managed Better Auth base URL (issuer / REST base). */
    NEON_AUTH_BASE_URL?: string;
    /** Origin header sent to Neon Auth (must be in Neon's trusted-domains list).
     *  Defaults to http://localhost:3000, which Neon already trusts. Used by the
     *  mobile auth proxy (/auth/*) so the device never calls Neon directly. */
    NEON_AUTH_ORIGIN?: string;
    /** R2 bucket for customer/market-intelligence photos. */
    PHOTOS?: R2Bucket;
    /** Server-side Google Geocoding API key (unrestricted) for photo stamping. */
    GOOGLE_GEOCODING_API_KEY?: string;
    /** Resend API key (secret) for the scheduled client report emails. */
    RESEND_API_KEY?: string;
    /** From header, e.g. "Sri Aparajita Reports <reports@updates.vardhansystems.in>". */
    REPORTS_FROM?: string;
    /** Recipient of the client report emails. */
    REPORTS_TO?: string;
    /** Public web base URL for the "View in Sri Aparajita" report link. */
    REPORTS_WEB_BASE_URL?: string;
    /** Health monitor (#7): DB round-trip (ms) above which status is "degraded". Default 2000. */
    HEALTH_DEGRADED_MS?: string;
    /** From header for outage alert emails. Falls back to REPORTS_FROM. Alerts are sent to REPORTS_TO. */
    ALERT_FROM?: string;
    /** Web Push (browser) VAPID keys — base64url raw point / raw scalar. */
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    /** VAPID contact, e.g. "mailto:support@vardhansystems.in". */
    VAPID_SUBJECT?: string;
    /** Razorpay Subscriptions — REST key id / secret (Basic auth). Test + live separate. */
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    /** Razorpay webhook signing secret — verifies x-razorpay-signature (HMAC-SHA256, raw body). */
    RAZORPAY_WEBHOOK_SECRET?: string;
    /** Razorpay monthly plan id (₹708/unit = 70800 paisa). Non-secret config var. */
    RAZORPAY_PLAN_ID?: string;
    /** Grace window after a failed renewal, in hours. Default 168 (7 days). Small value for testing. */
    GRACE_PERIOD_HOURS?: string;
    /** Master switch for server-side billing enforcement (the 402 gate). "true" = on. Default off. */
    BILLING_ENFORCED?: string;
    /** PostHog error tracking (exceptions only): public project token + host. */
    POSTHOG_PROJECT_TOKEN?: string;
    POSTHOG_HOST?: string;
    /** Inbound MCP server (apps/mcp) origin, e.g. https://sri-aparajita-mcp.<acct>.workers.dev (var). */
    MCP_SERVER_ORIGIN?: string;
    /** Shared bearer secret for the MCP server's /admin/* API (secret). Must match apps/mcp. */
    MCP_ADMIN_SECRET?: string;
  };
  Variables: {
    auth: AuthContext;
    requestId: string;
  };
}

export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}
