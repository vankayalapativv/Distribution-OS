import { neon } from "@neondatabase/serverless";
import { createMiddleware } from "hono/factory";
import type { SqlClient } from "../lib/db";
import { verifyNeonToken } from "../lib/neon-auth";
import { type Profile, resolveProfileResilient } from "./auth-profile";
import type { ApiEnv, AuthContext, Role } from "../types";

const roles = new Set<Role>([
  "SALES_EXECUTIVE",
  "LOGISTICS",
  "ACCOUNTANT",
  "MANAGER",
  "SUPER_ADMIN",
]);

function missingAuth(): AuthContext {
  return {
    email: null,
    externalUserId: null,
    isAuthenticated: false,
    isProviderAdmin: false,
    role: null,
    source: "missing",
    userId: null,
    enterpriseId: null,
  };
}

function bearerToken(authorization: string | null | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Shape one profile row into the normalized identity, validating the role. */
function normalizeProfile(row: Record<string, unknown> | undefined): Profile | null {
  if (!row) return null;
  const role = stringValue(row.role);
  return {
    userId: stringValue(row.userId),
    role: role && roles.has(role as Role) ? (role as Role) : null,
    enterpriseId: stringValue(row.enterpriseId),
  };
}

// The sub→profile mapping (userId + role) changes rarely, but was looked up on
// EVERY request. Cache it in-isolate with a short TTL to cut one DB round-trip per
// request (architecture audit G-0404), mirroring the role-permissions cache. Only
// successful lookups are cached; DB failures propagate to resolveProfileResilient.
const PROFILE_TTL_MS = 10_000;
interface ProfileCacheEntry {
  value: Profile | null;
  fetchedAt: number;
}
const profileCache = new Map<string, ProfileCacheEntry>();

/** Test-only: clear the isolate profile cache between cases. */
export function __clearProfileCache(): void {
  profileCache.clear();
}

function profileByAppLoginId(sql: SqlClient, subject: string) {
  return async (): Promise<Profile | null> => {
    const now = Date.now();
    const cached = profileCache.get(subject);
    if (cached && now - cached.fetchedAt < PROFILE_TTL_MS) return cached.value;
    // `user_roles` is many-to-many. Today every user holds exactly one role, but
    // if a user ever holds more than one we must resolve DETERMINISTICALLY —
    // picking the HIGHEST-privilege role, not an arbitrary `created_at` tiebreak
    // (which silently under/over-granted). NOTE: this keeps the single effective
    // role model; a true capability-UNION across multiple roles is a separate
    // design decision, not assumed here.
    const [row] = await sql`
      /* auth_app_profile */
      select
        u.id as "userId",
        u.enterprise_id as "enterpriseId",
        r.code as role
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id
      where u.app_login_id = ${subject}
      order by case r.code
        when 'SUPER_ADMIN' then 1
        when 'MANAGER' then 2
        when 'ACCOUNTANT' then 3
        when 'LOGISTICS' then 4
        when 'SALES_EXECUTIVE' then 5
        else 6
      end
      limit 1
    `;
    const value = normalizeProfile(row);
    profileCache.set(subject, { value, fetchedAt: now });
    return value;
  };
}

export const attachAuthContext = createMiddleware<ApiEnv>(async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  let auth = missingAuth();

  if (token && c.env.DATABASE_URL && c.env.NEON_JWKS_URL) {
    const sql = neon(c.env.DATABASE_URL);

    // Neon Managed Better Auth (EdDSA) token — verify against the JWKS, then map
    // the subject (Neon user id) to the app profile via users.app_login_id.
    // Verification is kept separate from the DB lookup: a verify failure means
    // "not a valid token" (stay unauthenticated), whereas a DB failure inside
    // resolveProfileResilient surfaces as a 503 rather than a false logout.
    let neonAuth: Awaited<ReturnType<typeof verifyNeonToken>> | null = null;
    try {
      neonAuth = await verifyNeonToken(token, c.env.NEON_JWKS_URL);
    } catch {
      neonAuth = null;
    }

    if (neonAuth) {
      auth = {
        ...auth,
        email: neonAuth.email,
        externalUserId: neonAuth.subject,
        source: "jwt",
      };
      const profile = await resolveProfileResilient(
        token,
        profileByAppLoginId(sql, neonAuth.subject),
      );
      if (profile) {
        auth = {
          ...auth,
          isAuthenticated: true,
          role: profile.role,
          userId: profile.userId,
          enterpriseId: profile.enterpriseId,
        };
      }
    }
  }

  c.set("auth", auth);

  await next();
});
