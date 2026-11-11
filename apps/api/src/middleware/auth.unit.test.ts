import { afterEach, describe, expect, it, vi } from "vitest";

// A token that FAILS verification must leave the request unauthenticated — a
// verify failure means "not a valid token", never a 503. We mock the verifier
// to throw and drive the middleware directly (no full app) to assert the catch
// path swallows it and falls back to the missing-auth identity.
const { verifyNeonToken } = vi.hoisted(() => ({ verifyNeonToken: vi.fn() }));
vi.mock("../lib/neon-auth", () => ({ verifyNeonToken }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => vi.fn() }));

import { attachAuthContext, __clearProfileCache } from "./auth";
import type { Context } from "hono";
import type { ApiEnv, AuthContext } from "../types";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function ctx(authorization?: string) {
  const store: Record<string, unknown> = {};
  const c = {
    env: { DATABASE_URL: "postgres://x", NEON_JWKS_URL: "https://jwks.test/keys" },
    req: { header: (k: string) => (k === "Authorization" ? authorization : undefined) },
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
  } as unknown as Context<ApiEnv>;
  return { c, store };
}

describe("attachAuthContext", () => {
  it("stays unauthenticated when token verification throws", async () => {
    verifyNeonToken.mockRejectedValueOnce(new Error("bad signature"));
    const { c, store } = ctx("Bearer bad.neon.token");
    const next = vi.fn().mockResolvedValue(undefined);
    await attachAuthContext(c, next);
    expect(next).toHaveBeenCalledOnce();
    expect(store.auth).toMatchObject<Partial<AuthContext>>({
      isAuthenticated: false,
      role: null,
      userId: null,
      source: "missing",
    });
  });

  it("stays unauthenticated when no bearer token is present", async () => {
    const { c, store } = ctx(undefined);
    await attachAuthContext(c, vi.fn().mockResolvedValue(undefined));
    expect(verifyNeonToken).not.toHaveBeenCalled();
    expect(store.auth).toMatchObject({ isAuthenticated: false, source: "missing" });
  });
});

describe("__clearProfileCache", () => {
  it("clears the isolate profile cache without throwing", () => {
    expect(() => __clearProfileCache()).not.toThrow();
  });
});
