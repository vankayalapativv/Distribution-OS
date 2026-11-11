import { describe, expect, it } from "vitest";
import { missingRequiredEnv } from "./env";

describe("missingRequiredEnv", () => {
  it("returns [] when every required var is set", () => {
    expect(missingRequiredEnv({ DATABASE_URL: "postgres://x", NEON_JWKS_URL: "https://x/jwks" })).toEqual([]);
  });

  it("lists vars that are undefined, null or empty", () => {
    expect(missingRequiredEnv({})).toEqual(["DATABASE_URL", "NEON_JWKS_URL"]);
    expect(missingRequiredEnv({ DATABASE_URL: "", NEON_JWKS_URL: null })).toEqual([
      "DATABASE_URL",
      "NEON_JWKS_URL",
    ]);
  });

  it("lists only the missing one when the other is present", () => {
    expect(missingRequiredEnv({ DATABASE_URL: "postgres://x" })).toEqual(["NEON_JWKS_URL"]);
  });
});
