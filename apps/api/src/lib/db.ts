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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (desc: any) => b.transaction([...scope(), desc]).then((r: any[]) => r[r.length - 1]);
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
    const sc = scope();
    return b.transaction([...sc, ...queries], opts).then((r: any[]) => r.slice(sc.length));
  };
  return fn as SqlClient;
}

/**
 * The request's database client.
 *
 * TODO(phase-2 cutover): once the auth middleware sets `enterpriseId` on the
 * request context, switch this to always return a scoped client and THROW when
 * the context is missing (fail closed). Until then it returns the unscoped
 * client so existing routes keep working during the migration.
 */
export function getSqlClient(c: Context<ApiEnv>): SqlClient {
  return neon(resolveDatabaseUrl(c));
}
