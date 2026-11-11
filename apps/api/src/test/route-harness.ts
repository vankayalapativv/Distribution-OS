/**
 * Shared harness for route tests: a Neon mock that routes each query to a
 * per-test responses map (by SQL-substring, usually the /* tag *\/) and answers
 * the auth middleware's profile lookup from a standard subject→role map, plus
 * auth headers/env helpers. Keeps per-route tests short.
 *
 * Usage (vi.mock must be hoisted, so pull the builder in via a dynamic import):
 *   const H = vi.hoisted(() => ({ responses: {} as Record<string, unknown> }));
 *   vi.mock("@neondatabase/serverless", async () => {
 *     const { makeNeon } = await import("../test/route-harness");
 *     return { neon: () => makeNeon(() => H.responses) };
 *   });
 *   beforeEach(() => { H.responses = { some_tag: [{...}] }; installAuth(); });
 */
import { vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "./auth";

export const IDS = {
  superAdmin: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  accountant: "00000000-0000-4000-8000-000000000003",
  se: "00000000-0000-4000-8000-000000000004",
  logistics: "00000000-0000-4000-8000-000000000005",
} as const;

type RoleKey = keyof typeof IDS;
const SUBJECT_TO_ROLE: Record<string, { id: string; role: string }> = {
  "neon-super-admin": { id: IDS.superAdmin, role: "SUPER_ADMIN" },
  "neon-manager": { id: IDS.manager, role: "MANAGER" },
  "neon-accountant": { id: IDS.accountant, role: "ACCOUNTANT" },
  "neon-se": { id: IDS.se, role: "SALES_EXECUTIVE" },
  "neon-logistics": { id: IDS.logistics, role: "LOGISTICS" },
};
const SUBJECT: Record<RoleKey, string> = {
  superAdmin: "neon-super-admin", manager: "neon-manager", accountant: "neon-accountant",
  se: "neon-se", logistics: "neon-logistics",
};

export const ENV = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

/** Request headers for a given role. */
export function headers(role: RoleKey): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders(SUBJECT[role]) };
}

/** Spy global fetch so the auth middleware's JWKS fetch resolves. Call per test. */
export function installAuth(): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()) as never);
}

type Responder = unknown[] | ((values: unknown[], query: string) => unknown[]);

/** Build the Neon tagged-template handler from a (live) responses getter. */
export function makeNeon(getResponses: () => Record<string, Responder>) {
  const resolve = (query: string, values: unknown[]): unknown[] => {
    if (query.includes("auth_app_profile")) {
      const e = SUBJECT_TO_ROLE[String(values[0])];
      return e ? [{ userId: e.id, role: e.role }] : [];
    }
    const responses = getResponses();
    for (const key of Object.keys(responses)) {
      if (query.includes(key)) {
        const r = responses[key];
        return typeof r === "function" ? r(values, query) : r;
      }
    }
    return [];
  };

  const handler = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = Array.isArray((strings as { raw?: unknown }).raw)
      ? (strings as readonly string[]).join(" ")
      : String(strings);
    return Promise.resolve(resolve(query, values));
  }) as ((s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>) & {
    query: (t: string, p?: unknown[]) => Promise<unknown[]>;
    transaction: (q: unknown[]) => Promise<unknown[]>;
    unsafe: (t: string) => Promise<unknown[]>;
  };
  handler.query = (text, params = []) => Promise.resolve(resolve(text, params));
  handler.transaction = async (queries) => Promise.all(queries as Promise<unknown>[]);
  handler.unsafe = (text) => Promise.resolve(resolve(text, []));
  return handler;
}
