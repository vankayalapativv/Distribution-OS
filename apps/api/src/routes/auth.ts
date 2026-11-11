import { Hono } from "hono";
import { success } from "../lib/api-response";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { optionalString, readJsonObject, requiredString } from "../lib/request-body";
import { resolveSignInEmail } from "../services/login-identity";
import { neonMintToken, neonSignIn, neonSignOut } from "../services/mobile-auth";
import type { ApiEnv } from "../types";

/**
 * Mobile auth proxy (PUBLIC — no requireAuth; the credentials/session ARE the
 * gate). The device talks only to this reliable Cloudflare host; the Worker does
 * the Neon Auth REST calls server-to-server. See services/mobile-auth.ts.
 * Mounted before the billing gate so a lapsed account can still sign in.
 */
export const authRoutes = new Hono<ApiEnv>()
  // Email-or-phone + password sign-in → { session, token, user }.
  .post("/login", async (c) => {
    const body = await readJsonObject(c);
    // `identifier` may be an email or a phone number. `email` is still accepted
    // for older app builds that predate phone login.
    const identifier = (optionalString(body, "identifier") ?? optionalString(body, "email") ?? "").trim();
    if (!identifier) throw new ApiError("VALIDATION_ERROR", "Email or phone is required.", 422);
    const password = requiredString(body, "password");
    // The app sends a descriptive device string (e.g. "SriAparajita/1.1.2
    // (Android 13; samsung; SM-G991B)"); forward it so the session is labelled
    // with the real phone on the admin "Manage sessions" screen. Fall back to
    // the request's own user-agent.
    const device = optionalString(body, "device") ?? c.req.header("user-agent");
    // A phone identifier is resolved to its account email first; an unknown
    // phone returns the same generic 401 as a wrong password (no enumeration).
    const email = await resolveSignInEmail(getSqlClient(c), identifier);
    if (!email) throw new ApiError("UNAUTHORIZED", "Invalid email/phone or password.", 401);
    const r = await neonSignIn(c.env, email, password, device);
    if (!r.ok) {
      throw new ApiError(
        r.status >= 500 ? "AUTH_UNAVAILABLE" : "UNAUTHORIZED",
        r.error,
        r.status >= 500 ? 503 : 401,
      );
    }
    // Mint the first API JWT here too, so the client gets session+token+user in
    // one round-trip. A failed mint still returns the session (client retries).
    const minted = await neonMintToken(c.env, r.session);
    const token = minted.status === "active" ? minted.token : null;
    return c.json(success(c, { session: r.session, token, user: r.user }));
  })
  // Mint/refresh a JWT from a stored session. Always 200 with a 3-way `status`
  // so the client distinguishes revoked (log out) from unavailable (keep).
  .post("/token", async (c) => {
    const body = await readJsonObject(c);
    const session = requiredString(body, "session");
    const outcome = await neonMintToken(c.env, session);
    return c.json(success(c, outcome));
  })
  // Best-effort session revoke on this device's logout.
  .post("/sign-out", async (c) => {
    const body = await readJsonObject(c);
    const session = requiredString(body, "session");
    await neonSignOut(c.env, session);
    return c.json(success(c, { ok: true }));
  });
