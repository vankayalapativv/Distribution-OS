import { describe, expect, test } from "vitest";
import { isMobileRole, MOBILE_ROLES } from "./auth-roles";

describe("isMobileRole — which roles may use the mobile app", () => {
  test("allows the field roles and SUPER_ADMIN", () => {
    expect(isMobileRole("SALES_EXECUTIVE")).toBe(true);
    expect(isMobileRole("LOGISTICS")).toBe(true);
    expect(isMobileRole("SUPER_ADMIN")).toBe(true);
  });

  test("blocks the web-only office roles", () => {
    expect(isMobileRole("MANAGER")).toBe(false);
    expect(isMobileRole("ACCOUNTANT")).toBe(false);
  });

  test("blocks a null / undefined / unknown role (e.g. not-yet-provisioned signup)", () => {
    expect(isMobileRole(null)).toBe(false);
    expect(isMobileRole(undefined)).toBe(false);
    expect(isMobileRole("")).toBe(false);
    expect(isMobileRole("PLATFORM_OWNER")).toBe(false);
  });

  test("the allow-list is exactly SE, Logistics, Super Admin", () => {
    expect([...MOBILE_ROLES].sort()).toEqual(["LOGISTICS", "SALES_EXECUTIVE", "SUPER_ADMIN"]);
  });

  // Guards the platform split: MANAGER/ACCOUNTANT are web-only, SE/LOGISTICS are
  // mobile-only, and SUPER_ADMIN is the only role on both. If someone adds a role
  // to one platform they must consciously decide the other — this documents it.
  test("is the complement of the web roles, sharing only SUPER_ADMIN", () => {
    const WEB_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];
    const shared = WEB_ROLES.filter((r) => (MOBILE_ROLES as readonly string[]).includes(r));
    expect(shared).toEqual(["SUPER_ADMIN"]);
  });
});
