import { describe, expect, it, vi, beforeEach } from "vitest";

const { requireSessionRole, requireAuthToken, canAccessSection, dashboardForRole, redirect } = vi.hoisted(() => ({
  requireSessionRole: vi.fn(),
  requireAuthToken: vi.fn(async () => "jwt"),
  canAccessSection: vi.fn(() => true),
  dashboardForRole: vi.fn(() => "/home"),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/auth-role", () => ({
  canAccessSection: (...a: unknown[]) => canAccessSection(...(a as [])),
  dashboardForRole: (...a: unknown[]) => dashboardForRole(...(a as [])),
  requireSessionRole: (...a: unknown[]) => requireSessionRole(...(a as [])),
}));
vi.mock("@/features/auth/server-session", () => ({ requireAuthToken: () => requireAuthToken() }));
vi.mock("@/features/customers/customers-api", () => ({ getActionConfig: () => ({ apiBaseUrl: "http://api" }) }));
vi.mock("@/features/customers/customers-list", () => ({ CustomersList: () => null }));

import CustomersPage from "./page";
import { CustomersList } from "@/features/customers/customers-list";

beforeEach(() => {
  canAccessSection.mockReturnValue(true);
  requireSessionRole.mockResolvedValue({ role: "SUPER_ADMIN" });
});

describe("CustomersPage", () => {
  it("renders the list with the role + action config for an allowed user", async () => {
    const el = await CustomersPage();
    expect(el.type).toBe(CustomersList);
    expect(el.props.role).toBe("SUPER_ADMIN");
    expect(el.props.actionConfig).toEqual({ apiBaseUrl: "http://api", authToken: "jwt" });
  });

  it("redirects a user who cannot access the customers section", async () => {
    canAccessSection.mockReturnValue(false);
    requireSessionRole.mockResolvedValue({ role: "SALES_EXECUTIVE" });
    await expect(CustomersPage()).rejects.toThrow("REDIRECT:/home");
    expect(dashboardForRole).toHaveBeenCalled();
  });
});
