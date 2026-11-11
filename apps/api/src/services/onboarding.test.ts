import { describe, expect, it } from "vitest";
import { bootstrapAccount } from "./onboarding";
import { makeSql } from "../test/sql-mock";

/** A Postgres unique-violation shaped like the Neon driver's error. */
function uniqueViolation(constraint: string) {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: "23505", constraint },
  );
}

const input = {
  externalUserId: "neon-sub-1",
  email: "new@distios.test",
  name: "New Admin",
  phone: "+919812345678",
};

describe("bootstrapAccount", () => {
  it("is idempotent — returns the existing user without inserting", async () => {
    const sql = makeSql({ onboarding_find_user: [{ id: "u-existing", enterpriseId: null }] });
    const out = await bootstrapAccount(sql, input);
    expect(out).toEqual({ userId: "u-existing" });
    expect(sql.calls.some((c) => c.tag === "onboarding_bootstrap_user")).toBe(false);
  });

  it("creates the row when the identity is new", async () => {
    const sql = makeSql({
      onboarding_find_user: [],
      onboarding_bootstrap_user: [{ id: "u-new" }],
    });
    expect(await bootstrapAccount(sql, input)).toEqual({ userId: "u-new" });
  });

  it("maps a duplicate PHONE to a 409 (not an opaque 500)", async () => {
    const sql = makeSql({
      onboarding_find_user: [],
      onboarding_bootstrap_user: () => {
        throw uniqueViolation("users_phone_key");
      },
    });
    await expect(bootstrapAccount(sql, input)).rejects.toMatchObject({
      status: 409,
      code: "PHONE_IN_USE",
    });
  });

  it("maps a duplicate EMAIL to a 409", async () => {
    const sql = makeSql({
      onboarding_find_user: [],
      onboarding_bootstrap_user: () => {
        throw uniqueViolation("users_email_key");
      },
    });
    await expect(bootstrapAccount(sql, input)).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_IN_USE",
    });
  });

  it("rethrows a non-unique error untouched", async () => {
    const sql = makeSql({
      onboarding_find_user: [],
      onboarding_bootstrap_user: () => {
        throw new Error("connection reset");
      },
    });
    await expect(bootstrapAccount(sql, input)).rejects.toThrow("connection reset");
  });
});
