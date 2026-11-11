import { describe, expect, it, vi } from "vitest";

const { neon } = vi.hoisted(() => ({ neon: vi.fn(() => "SQL") }));
vi.mock("@neondatabase/serverless", () => ({ neon }));

import { getSqlClient } from "./db";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

describe("getSqlClient", () => {
  it("returns a Neon client built from DATABASE_URL", () => {
    const c = { env: { DATABASE_URL: "postgres://x" } } as unknown as Context<ApiEnv>;
    expect(getSqlClient(c)).toBe("SQL");
    expect(neon).toHaveBeenCalledWith("postgres://x");
  });

  it("throws DATABASE_NOT_CONFIGURED (500) when DATABASE_URL is missing", () => {
    const c = { env: {} } as unknown as Context<ApiEnv>;
    let err: unknown;
    try {
      getSqlClient(c);
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "DATABASE_NOT_CONFIGURED", status: 500 });
  });
});
