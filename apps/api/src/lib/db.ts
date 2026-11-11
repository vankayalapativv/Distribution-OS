import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Context } from "hono";
import { ApiError } from "./api-error";
import type { ApiEnv } from "../types";

export type SqlClient = NeonQueryFunction<false, false>;

function resolveDatabaseUrl(c: Context<ApiEnv>): string {
  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ApiError(
      "DATABASE_NOT_CONFIGURED",
      "DATABASE_URL is not configured for the API runtime.",
      500,
    );
  }
  return databaseUrl;
}

/**
 * Unscoped OWNER client. Connects as the database owner, so Postgres RLS does
 * NOT apply (we ENABLE but do not FORCE RLS). Use this ONLY for:
 *   - auth resolution (looking up a user's role + enterprise before scope exists)
 *   - platform-owner / control-plane queries (the admin cockpit: enterprises,
 *     billing, approvals, cross-enterprise reads).
 * Never use it for ordinary enterprise business queries — those must go through
 * getSqlClient so RLS isolates them.
 */
export function getOwnerSqlClient(c: Context<ApiEnv>): SqlClient {
  return neon(resolveDatabaseUrl(c));
}

/**
 * Wrap a base neon client so every query/transaction runs enterprise-scoped:
 * each one is sent as a single HTTP transaction prefixed with
 *   SET LOCAL ROLE app_tenant;  -- RLS applies (app_tenant is not the owner)
 *   app.enterprise_id = <id>;    -- the isolation key the RLS policies read
 *   app.user_id = <id>;          -- for onboarding_drafts
 * so Postgres RLS filters every row to the caller's enterprise.
 *
 * neon's lazy-descriptor composition is preserved: the tagged template and
 * `.query`/`.unsafe` still return descriptors that compose into `.transaction`,
 * but a standalone `await` routes through a scoped transaction (via a Proxy that
 * intercepts `then`/`catch`/`finally` and forwards everything else to the
 * underlying descriptor). Verified against the live DB in
 * packages/db/tools/verify-rls.mjs and the app-scoping probe.
 */
export function createScopedSqlClient(
  base: SqlClient,
  enterpriseId: string,
  userId?: string | null,
): SqlClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = base as any;
  const scope = () => [
    b`set local role app_tenant`,
    b`select set_config('app.enterprise_id', ${enterpriseId}, true)`,
    b`select set_config('app.user_id', ${userId ?? null}, true)`,
  ];
  // Real neon always exposes `.transaction` (one HTTP round-trip, one backend
  // connection) — required so the SET LOCALs and the query share a session.
  // Some unit-test mocks implement only the tagged template; there scoping is
  // moot (no real RLS), so fall back to resolving the query directly.
  const hasTxn = typeof b.transaction === "function";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (desc: any) =>
    hasTxn
      ? b.transaction([...scope(), desc]).then((r: any[]) => r[r.length - 1])
      : Promise.resolve(desc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = (d: any) =>
    new Proxy(d, {
      get(t, p, r) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (p === "then") return (res: any, rej: any) => run(t).then(res, rej);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (p === "catch") return (rej: any) => run(t).catch(rej);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (p === "finally") return (f: any) => run(t).finally(f);
        return Reflect.get(t, p, r);
      },
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = (strings: TemplateStringsArray, ...values: any[]) => wrap(b(strings, ...values));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn.query = (text: string, params?: any[], opts?: any) => wrap(b.query(text, params, opts));
  fn.unsafe = (text: string) => wrap(b.unsafe(text));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn.transaction = (queries: any[], opts?: any) => {
    if (!hasTxn) return Promise.all(queries);
    const sc = scope();
    return b.transaction([...sc, ...queries], opts).then((r: any[]) => r.slice(sc.length));
  };
  return fn as SqlClient;
}

/**
 * The request's database client.
 *
 * - **Authenticated enterprise request** → an enterprise-SCOPED client (RLS
 *   isolates every query to the caller's enterprise). Fails closed: an
 *   authenticated user without an enterprise is a 403 (never an unscoped read).
 * - **Unauthenticated request** (webhook / public statement / health / login
 *   before a session) → the unscoped owner client, since these legitimately run
 *   with no enterprise context. (A future platform-owner cockpit will use
 *   getOwnerSqlClient explicitly.)
 */
export function getSqlClient(c: Context<ApiEnv>): SqlClient {
  const base = neon(resolveDatabaseUrl(c));
  const auth = c.get("auth");
  if (auth?.isAuthenticated) {
    if (!auth.enterpriseId) {
      throw new ApiError(
        "NO_ENTERPRISE_CONTEXT",
        "Authenticated user is not associated with an enterprise.",
        403,
      );
    }
    return createScopedSqlClient(base, auth.enterpriseId, auth.userId);
  }
  return base;
}
