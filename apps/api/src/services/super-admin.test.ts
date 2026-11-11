import { describe, expect, it } from "vitest";
import {
  createSuperAdminUser,
  getSuperAdminSetup,
  getUserLatestDevice,
  updateSuperAdminUser,
} from "./super-admin";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "admin-1" };

describe("getSuperAdminSetup", () => {
  it("maps users (comma roles, empty roles)", async () => {
    const sql = makeSql({
      super_admin_setup_users: [{ id: "u1", name: "Asha", email: "a@b.c", phone: "9", status: "active", appLoginId: null, roles: "MANAGER,SUPER_ADMIN" }, { id: "u2", name: "NoRole", roles: null }],
    });
    const out = await getSuperAdminSetup(sql, CTX);
    expect(out.users[0].roles).toEqual(["MANAGER", "SUPER_ADMIN"]);
    expect(out.users[1].roles).toEqual([]); // null roles → []
  });
});

describe("createSuperAdminUser", () => {
  it("422s an unsupported role and a missing role row", async () => {
    await expect(createSuperAdminUser(makeSql(), CTX, { name: "X", email: null, phone: null, role: "WIZARD" as never })).rejects.toMatchObject({ status: 422 });
    await expect(createSuperAdminUser(makeSql({ super_admin_role_lookup: [] }), CTX, { name: "X", email: null, phone: null, role: "MANAGER" })).rejects.toMatchObject({ status: 422 });
  });
  it("creates the user + role in one transaction", async () => {
    const sql = makeSql({ super_admin_role_lookup: [{ id: "role-1" }], super_admin_create_user: [{ id: "u9", name: "Asha", email: null, phone: null, status: "active" }] });
    expect(await createSuperAdminUser(sql, CTX, { name: "Asha", email: null, phone: null, role: "MANAGER" })).toMatchObject({ id: "u9", role: "MANAGER" });
  });
  it("maps a duplicate phone/email to a FIELD-SPECIFIC 409 (not an opaque 500)", async () => {
    const uv = (c: string) =>
      Object.assign(new Error(`duplicate key value violates unique constraint "${c}"`), { code: "23505", constraint: c });
    const phoneDup = makeSql({ super_admin_role_lookup: [{ id: "role-1" }], super_admin_create_user: () => { throw uv("users_phone_key"); } });
    await expect(
      createSuperAdminUser(phoneDup, CTX, { name: "X", email: "a@b.c", phone: "+91999", role: "MANAGER" }),
    ).rejects.toMatchObject({ status: 409, code: "PHONE_IN_USE" });
    const emailDup = makeSql({ super_admin_role_lookup: [{ id: "role-1" }], super_admin_create_user: () => { throw uv("users_email_key"); } });
    await expect(
      createSuperAdminUser(emailDup, CTX, { name: "X", email: "a@b.c", phone: "+91999", role: "MANAGER" }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
  });
});

describe("updateSuperAdminUser", () => {
  const ok = { super_admin_get_user: [{ id: "u1" }], super_admin_user_unique_check: [], super_admin_update_user: [{ id: "u1", name: "Asha", email: null, phone: null, status: "active" }] };
  it("validates name + status, 404s missing, 409s a clash, else updates", async () => {
    await expect(updateSuperAdminUser(makeSql(), CTX, "u1", { name: " ", email: null, phone: null, status: "active" })).rejects.toMatchObject({ status: 422 });
    await expect(updateSuperAdminUser(makeSql(), CTX, "u1", { name: "X", email: null, phone: null, status: "frozen" })).rejects.toMatchObject({ status: 422 });
    await expect(updateSuperAdminUser(makeSql({ super_admin_get_user: [] }), CTX, "u1", { name: "X", email: null, phone: null, status: "active" })).rejects.toMatchObject({ status: 404 });
    await expect(updateSuperAdminUser(makeSql({ super_admin_get_user: [{ id: "u1" }], super_admin_user_unique_check: [{ emailClash: true }] }), CTX, "u1", { name: "X", email: "a@b.c", phone: null, status: "active" })).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
    await expect(updateSuperAdminUser(makeSql({ super_admin_get_user: [{ id: "u1" }], super_admin_user_unique_check: [{ phoneClash: true }] }), CTX, "u1", { name: "X", email: null, phone: "+91999", status: "active" })).rejects.toMatchObject({ status: 409, code: "PHONE_IN_USE" });
    expect(await updateSuperAdminUser(makeSql(ok), CTX, "u1", { name: "Asha", email: null, phone: null, status: "active" })).toMatchObject({ id: "u1" });
  });
});

describe("getUserLatestDevice", () => {
  it("prefers the push-token device, falls back to tracking, null when neither", async () => {
    expect(await getUserLatestDevice(makeSql(), "u1")).toBeNull();
    // Push-token device (every login, all roles).
    const push = makeSql({
      user_device_from_push: [{ manufacturer: "Samsung", model: "SM-G991B", androidVersion: null, lastSeenAt: "2026-10-01" }],
    });
    expect(await getUserLatestDevice(push, "u1")).toMatchObject({ label: "Samsung SM-G991B", model: "SM-G991B" });
    // Falls back to the field tracking heartbeat when no push device.
    const tracking = makeSql({
      user_device_from_tracking: [{ manufacturer: "Xiaomi", model: "Redmi 9", androidVersion: "11", lastSeenAt: "2026-09-01" }],
    });
    expect(await getUserLatestDevice(tracking, "u1")).toMatchObject({ label: "Xiaomi Redmi 9", androidVersion: "11" });
  });
});
