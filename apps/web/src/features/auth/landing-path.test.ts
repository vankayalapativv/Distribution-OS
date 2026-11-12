import { describe, expect, it } from "vitest";
import { landingPathFor } from "./auth-role";

/**
 * A returning user is routed by onboarding STATE, not role alone: a half-finished
 * signup resumes the wizard, a submitted/rejected one sees its status, and only an
 * active enterprise with a web role reaches the dashboard. Guards the fix for
 * signed-up-but-not-onboarded users being rejected at /login.
 */
describe("landingPathFor", () => {
  it("active enterprise + web role → dashboard", () => {
    expect(landingPathFor("SUPER_ADMIN", "active")).toBe("/");
    expect(landingPathFor("MANAGER", "active")).toBe("/");
    expect(landingPathFor("ACCOUNTANT", "active")).toBe("/");
  });

  it("active enterprise + non-web role (SE / Logistics) → session cleared", () => {
    expect(landingPathFor("SALES_EXECUTIVE", "active")).toBe("/api/auth/logout?error=no_web_access");
    expect(landingPathFor("LOGISTICS", "active")).toBe("/api/auth/logout?error=no_web_access");
  });

  it("mid-onboarding draft (role-less, HAS a users row) → resume the wizard", () => {
    expect(landingPathFor(null, "draft")).toBe("/onboarding");
  });

  it("submitted (pending) or rejected → onboarding status, not the dashboard", () => {
    expect(landingPathFor("SUPER_ADMIN", "pending")).toBe("/onboarding");
    expect(landingPathFor("SUPER_ADMIN", "rejected")).toBe("/onboarding");
  });

  it("no_account (platform owner / orphan, NO users row) → NOT onboarding", () => {
    // The owner has no enterprise `users` row; it must never land on "Set up your
    // company". Cleared back to /login instead.
    expect(landingPathFor(null, "no_account")).toBe("/api/auth/logout?error=not_registered");
    expect(landingPathFor("SUPER_ADMIN", "no_account")).toBe("/api/auth/logout?error=not_registered");
  });
});
