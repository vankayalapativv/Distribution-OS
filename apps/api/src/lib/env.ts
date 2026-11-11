/**
 * Required-environment validation (architecture audit G-0502). Workers has no
 * single startup, so the API surfaces config health via the /health endpoint
 * (`configOk`) instead — a deploy or monitor can then catch a Worker that is
 * missing its core secrets before it silently misbehaves.
 *
 * Only genuinely load-bearing config is listed. Feature secrets (RESEND_API_KEY,
 * VAPID_*, GOOGLE_GEOCODING_API_KEY) are intentionally excluded — those features
 * degrade gracefully when unset. See .env.example for the full documented set.
 */
const REQUIRED_ENV = ["DATABASE_URL", "NEON_JWKS_URL"] as const;

/** Names of the required env vars that are absent/empty. */
export function missingRequiredEnv(env: Record<string, unknown>): string[] {
  return REQUIRED_ENV.filter((key) => {
    const v = env[key];
    return v === undefined || v === null || v === "";
  });
}
