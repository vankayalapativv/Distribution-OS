import { describe, expect, it } from "vitest";
import { getMyProfile, updateMyProfile } from "./me-profile";
import { makeSql } from "../test/sql-mock";

const USER = "11111111-2222-4333-8444-555555555555";

describe("getMyProfile", () => {
  it("returns the mapped profile (blank email/phone → null)", async () => {
    const sql = makeSql({ me_profile: [{ id: USER, name: "Asha", email: "", phone: "999" }] });
    expect(await getMyProfile(sql, USER)).toEqual({ id: USER, name: "Asha", email: null, phone: "999" });
  });

  it("coerces absent (null) name/email/phone to '' / null", async () => {
    const sql = makeSql({ me_profile: [{ id: USER, name: null, email: null, phone: null }] });
    expect(await getMyProfile(sql, USER)).toEqual({ id: USER, name: "", email: null, phone: null });
  });

  it("throws 404 when the user row is missing", async () => {
    const sql = makeSql({ me_profile: [] });
    await expect(getMyProfile(sql, USER)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("updateMyProfile", () => {
  it("updates and returns the new profile", async () => {
    const sql = makeSql({ update_me_profile: [{ id: USER, name: "Asha N", email: "a@b.c", phone: "1234567890" }] });
    expect(await updateMyProfile(sql, USER, { name: "Asha N" })).toMatchObject({ name: "Asha N", email: "a@b.c" });
  });

  it("maps a unique-phone violation (23505) to a 409", async () => {
    const sql = makeSql({
      update_me_profile: () => {
        throw new Error('duplicate key value violates unique constraint "users_phone_key" (23505)');
      },
    });
    await expect(updateMyProfile(sql, USER, { phone: "999" })).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("rethrows an unrelated DB error unchanged", async () => {
    const boom = new Error("connection reset");
    const sql = makeSql({
      update_me_profile: () => {
        throw boom;
      },
    });
    await expect(updateMyProfile(sql, USER, { name: "x" })).rejects.toBe(boom);
  });

  it("throws 404 when the update matches no row", async () => {
    const sql = makeSql({ update_me_profile: [] });
    await expect(updateMyProfile(sql, USER, { name: "x" })).rejects.toMatchObject({ status: 404 });
  });
});
