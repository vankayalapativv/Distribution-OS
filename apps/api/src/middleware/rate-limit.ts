import type { Context, MiddlewareHandler } from "hono";
import { failure } from "../lib/api-response";
import type { ApiEnv } from "../types";

/**
 * Cloudflare Workers native Rate Limiting binding.
 * `limit({ key })` returns `{ success: false }` once the key exceeds the
 * configured limit within the period. Bindings are declared in wrangler.jsonc
 * under `unsafe.bindings` (type "ratelimit").
 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The client's IP, from Cloudflare's trusted header (never a spoofable body field). */
function clientIp(c: Context<ApiEnv>): string {
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf.trim();
  // Fallback for non-CF runtimes (local wrangler): first hop of x-forwarded-for.
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/**
 * Per-IP rate-limit middleware for a route group.
 *
 * `binding` names the `env` key of a Workers rate-limit binding. When that
 * binding is absent — local `wrangler dev` without it, or unit tests — the
 * middleware is a no-op, so dev and tests are never throttled. On a breach it
 * returns 429 with a `Retry-After` header (the window, in seconds) and the
 * standard failure body, and does NOT call the handler.
 */
export function rateLimit(
  binding: "RL_LOGIN" | "RL_PUBLIC" | "RL_ONBOARD",
  keyPrefix: string,
  periodSeconds = 60,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const limiter = c.env[binding] as RateLimitBinding | undefined;
    if (!limiter || typeof limiter.limit !== "function") return next();

    const key = `${keyPrefix}:${clientIp(c)}`;
    const { success } = await limiter.limit({ key });
    if (success) return next();

    c.header("Retry-After", String(periodSeconds));
    return c.json(
      failure(
        c,
        "RATE_LIMITED",
        "Too many requests. Please wait a moment and try again.",
      ),
      429,
    );
  };
}
