import { describe, expect, it, vi, beforeEach } from "vitest";

const { requireSectionAccess, requireAuthToken, redirect } = vi.hoisted(() => ({
  requireSectionAccess: vi.fn(),
  requireAuthToken: vi.fn(async () => "jwt"),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/auth-role", () => ({
  requireSectionAccess: (...a: unknown[]) => requireSectionAccess(...(a as [])),
}));
vi.mock("@/features/auth/server-session", () => ({ requireAuthToken: () => requireAuthToken() }));
vi.mock("@/features/customers/customers-api", () => ({
  getActionConfig: () => ({ apiBaseUrl: "http://api" }),
}));
vi.mock("@/features/customers/customer-detail", () => ({ CustomerDetail: () => null }));

import CustomerDetailPage from "./page";
import { CustomerDetail } from "@/features/customers/customer-detail";

const params = Promise.resolve({ id: "c1" });

beforeEach(() => {
  requireSectionAccess.mockResolvedValue({ role: "MANAGER" });
});

describe("CustomerDetailPage", () => {
  it("gates access and hands the customer id + auth token to the client detail", async () => {
    const el = await CustomerDetailPage({ params });
    expect(el.type).toBe(CustomerDetail);
    // The customer itself is now fetched on the client — the route only passes the id.
    expect(el.props.customerId).toBe("c1");
    expect(el.props.role).toBe("MANAGER");
    expect(el.props.actionConfig).toMatchObject({ apiBaseUrl: "http://api", authToken: "jwt" });
  });

  it("redirects when the section isn't accessible", async () => {
    requireSectionAccess.mockRejectedValue(new Error("REDIRECT:/home"));
    await expect(CustomerDetailPage({ params })).rejects.toThrow("REDIRECT:/home");
  });
});
