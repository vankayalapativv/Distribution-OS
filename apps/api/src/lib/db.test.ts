import { describe, expect, it, vi } from "vitest";

const { neon } = vi.hoisted(() => ({ neon: vi.fn(() => "SQL") }));
vi.mock("@neondatabase/serverless", () => ({ neon }));

import { getSqlClient } from "./db";
import type { Context } from "hono";
import type { ApiEnv, AuthContext } from "../types";

function ctx(env: Record<string, unknown>, auth?: Partial<AuthContext>): Context<ApiEnv> {
  return {
    env,
    get: (k: string) => (k === "auth" ? auth : undefined),
  } as unknown as Context<ApiEnv>;
}

describe("getSqlClient", () => {
  it("returns the unscoped Neon client for an unauthenticated request", () => {
    expect(getSqlClient(ctx({ DATABASE_URL: "postgres://x" }))).toBe("SQL");
    expect(neon).toHaveBeenCalledWith("postgres://x");
  });

  it("throws DATABASE_NOT_CONFIGURED (500) when DATABASE_URL is missing", () => {
    let err: unknown;
    try {
      getSqlClient(ctx({}));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "DATABASE_NOT_CONFIGURED", status: 500 });
  });

  it("throws NO_ENTERPRISE_CONTEXT (403) for an authenticated user with no enterprise", () => {
    let err: unknown;
    try {
      getSqlClient(ctx({ DATABASE_URL: "postgres://x" }, { isAuthenticated: true, enterpriseId: null }));
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "NO_ENTERPRISE_CONTEXT", status: 403 });
  });

  it("returns a scoped client (not the bare base) for an authenticated enterprise user", () => {
    const scoped = getSqlClient(
      ctx({ DATABASE_URL: "postgres://x" }, { isAuthenticated: true, enterpriseId: "ent-1", userId: "u1" }),
    );
    // scoped adapter is a function with a .transaction method, not the bare "SQL" string
    expect(typeof scoped).toBe("function");
    expect(scoped).not.toBe("SQL");
  });
});
