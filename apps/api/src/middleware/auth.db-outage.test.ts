import { describe, expect, test, vi } from "vitest";

// #4: a DB outage during the per-request auth lookup must surface as a retryable
// 503 — NOT a false 401 (logged out) or a generic 500. The token verifies fine
// (Neon JWKS mocked), but the profile lookup hits a DB that throws on every query.
const USER_SUB = "neon-subject-0000-4000-8000-000000000004";

vi.mock("../lib/neon-auth", () => ({
  verifyNeonToken: async () => ({ subject: USER_SUB, email: "field@sriaparajita.com" }),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async () => {
    throw new Error("neon: connection failed");
  },
}));

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  NEON_JWKS_URL: "https://example.test/jwks",
};

describe("auth middleware — #4 DB outage → 503, not a false logout", () => {
  test("a valid Neon token during a DB outage yields a retryable 503", async () => {
    const { default: app } = await import("../index");
    const res = await app.request(
      "/api/v1/me",
      { headers: { Authorization: "Bearer any.neon.token" } },
      env,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("SERVICE_UNAVAILABLE");
  });
});
