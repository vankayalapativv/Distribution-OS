import { describe, expect, it } from "vitest";
import type { SqlClient } from "../lib/db";
import { resolveSignInEmail } from "./login-identity";

/** A tagged-template stub that returns the given rows for any query. */
function fakeSql(rows: unknown[]): SqlClient {
  return (() => Promise.resolve(rows)) as unknown as SqlClient;
}

describe("resolveSignInEmail", () => {
  it("passes an email straight through (trimmed, no DB hit)", async () => {
    // Rows would 500 if queried — proving the email path never touches the DB.
    expect(await resolveSignInEmail(fakeSql([{ bad: true }]), "  Me@X.com ")).toBe("Me@X.com");
  });

  it("resolves a phone (any format) to its single active account email", async () => {
    const sql = fakeSql([{ email: "se@x.com" }]);
    expect(await resolveSignInEmail(sql, "+91 99852 94475")).toBe("se@x.com");
    expect(await resolveSignInEmail(sql, "099852-94475")).toBe("se@x.com");
    expect(await resolveSignInEmail(sql, "9985294475")).toBe("se@x.com");
  });

  it("returns null for an unknown phone (no match)", async () => {
    expect(await resolveSignInEmail(fakeSql([]), "9000000000")).toBeNull();
  });

  it("returns null for an ambiguous phone (two active matches) — fail safe", async () => {
    const sql = fakeSql([{ email: "a@x.com" }, { email: "b@x.com" }]);
    expect(await resolveSignInEmail(sql, "9985294475")).toBeNull();
  });

  it("returns null for a too-short phone (fewer than 10 digits)", async () => {
    expect(await resolveSignInEmail(fakeSql([{ email: "x@x.com" }]), "12345")).toBeNull();
  });
});
