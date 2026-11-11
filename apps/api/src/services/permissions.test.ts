import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearPermissionCache,
  effectivePermissionsForRole,
  getEffectivePermissionsCached,
  getPermissionMatrix,
  getRolePermissions,
  isConfigurableRole,
  isKnownPermissionKey,
  partitionPermissionUpdates,
  setRolePermissions,
} from "./permissions";
import { makeSql, calledTag } from "../test/sql-mock";

afterEach(() => {
  __clearPermissionCache();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("catalog helpers", () => {
  it("isConfigurableRole + isKnownPermissionKey", () => {
    expect(isConfigurableRole("MANAGER")).toBe(true);
    expect(isConfigurableRole("SALES_EXECUTIVE" as never)).toBe(false);
    expect(isKnownPermissionKey("section:orders")).toBe(true);
    expect(isKnownPermissionKey("section:nope")).toBe(false);
  });
});

describe("getRolePermissions / getPermissionMatrix", () => {
  it("merges overrides over defaults (invalid keys dropped)", async () => {
    const sql = makeSql({ role_permission_overrides: [{ key: "section:invoices", allowed: true }, { key: "section:bogus", allowed: true }] });
    const perms = await getRolePermissions(sql, "MANAGER");
    expect(perms["section:invoices"]).toBe(true); // override on (default was false for MANAGER)
    expect(perms).not.toHaveProperty("section:bogus");
  });
  it("matrix carries the catalog + both roles", async () => {
    const m = await getPermissionMatrix(makeSql({ role_permission_overrides: [] }));
    expect(m.roles).toHaveProperty("MANAGER");
    expect(m.catalog.length).toBeGreaterThan(0);
  });
});

describe("getEffectivePermissionsCached", () => {
  it("caches, then serves stale / defaults when the DB later fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const ok = makeSql({ role_permission_overrides: [{ key: "section:invoices", allowed: true }] });
    const first = await getEffectivePermissionsCached(ok, "MANAGER");
    expect(first["section:invoices"]).toBe(true);
    // cache hit (no new query)
    const hit = makeSql({ role_permission_overrides: () => { throw new Error("no"); } });
    expect(await getEffectivePermissionsCached(hit, "MANAGER")).toEqual(first);
    // past TTL but within MAX_STALE → stale value on error
    vi.setSystemTime(20_000);
    const stale = makeSql({ role_permission_overrides: () => { throw new Error("db down"); } });
    expect(await getEffectivePermissionsCached(stale, "MANAGER")).toEqual(first);
    // no usable cache → catalog defaults
    __clearPermissionCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const def = await getEffectivePermissionsCached(makeSql({ role_permission_overrides: () => { throw new Error("x"); } }), "ACCOUNTANT");
    expect(def["section:invoices"]).toBe(true); // ACCOUNTANT default
  });
});

describe("effectivePermissionsForRole", () => {
  it("SUPER_ADMIN all-true, configurable from DB, others empty", async () => {
    const sa = await effectivePermissionsForRole(makeSql(), "SUPER_ADMIN");
    expect(Object.values(sa).every(Boolean)).toBe(true);
    expect(await effectivePermissionsForRole(makeSql({ role_permission_overrides: [] }), "MANAGER")).toHaveProperty("section:orders");
    expect(await effectivePermissionsForRole(makeSql(), "SALES_EXECUTIVE")).toEqual({});
  });
});

describe("partitionPermissionUpdates", () => {
  it("splits upserts (differ) from deletes (equal default), dropping invalid", () => {
    const { toUpsert, toDelete } = partitionPermissionUpdates("MANAGER", [
      { key: "section:invoices", allowed: true }, // default false → upsert
      { key: "section:orders", allowed: true }, // default true → delete
      { key: "section:bogus", allowed: true }, // invalid → dropped
    ]);
    expect(toUpsert).toEqual([{ key: "section:invoices", allowed: true }]);
    expect(toDelete).toEqual(["section:orders"]);
  });
});

describe("setRolePermissions", () => {
  it("rejects a non-configurable role", async () => {
    await expect(setRolePermissions(makeSql(), "SALES_EXECUTIVE" as never, [], "u1")).rejects.toThrow(/not configurable/);
  });
  it("upserts + deletes then returns fresh perms", async () => {
    const sql = makeSql({ role_permission_overrides: [] });
    await setRolePermissions(sql, "MANAGER", [
      { key: "section:invoices", allowed: true },
      { key: "section:orders", allowed: true },
    ], "u1");
    expect(calledTag(sql, "role_permission_upsert")).toBe(true);
    expect(calledTag(sql, "role_permission_reset_to_default")).toBe(true);
  });
});
