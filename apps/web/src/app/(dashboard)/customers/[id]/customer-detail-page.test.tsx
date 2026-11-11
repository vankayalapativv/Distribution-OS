import { describe, expect, it, vi, beforeEach } from "vitest";

const { requireSectionAccess, requireAuthToken, getCustomer, redirect, notFound } = vi.hoisted(() => ({
  requireSectionAccess: vi.fn(),
  requireAuthToken: vi.fn(async () => "jwt"),
  getCustomer: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/features/auth/auth-role", () => ({
  requireSectionAccess: (...a: unknown[]) => requireSectionAccess(...(a as [])),
}));
vi.mock("@/features/auth/server-session", () => ({ requireAuthToken: () => requireAuthToken() }));
vi.mock("@/features/customers/customers-api", () => ({
  getActionConfig: () => ({ apiBaseUrl: "http://api" }),
  getCustomer: (...a: unknown[]) => getCustomer(...(a as [])),
}));
vi.mock("@/features/customers/customer-detail", () => ({ CustomerDetail: () => null }));

import CustomerDetailPage from "./page";
import { CustomerDetail } from "@/features/customers/customer-detail";

const params = Promise.resolve({ id: "c1" });

beforeEach(() => {
  requireSectionAccess.mockResolvedValue({ role: "MANAGER" });
  getCustomer.mockResolvedValue({ id: "c1", legalName: "Raj" });
});

describe("CustomerDetailPage", () => {
  it("renders the detail for an office role with the fetched customer", async () => {
    const el = await CustomerDetailPage({ params });
    expect(el.type).toBe(CustomerDetail);
    expect(el.props.customer).toEqual({ id: "c1", legalName: "Raj" });
    expect(el.props.role).toBe("MANAGER");
    expect(getCustomer).toHaveBeenCalledWith("c1");
  });

  it("redirects when the section isn't accessible", async () => {
    requireSectionAccess.mockRejectedValue(new Error("REDIRECT:/home"));
    await expect(CustomerDetailPage({ params })).rejects.toThrow("REDIRECT:/home");
  });

  it("calls notFound when the customer can't be fetched", async () => {
    getCustomer.mockRejectedValue(new Error("404"));
    await expect(CustomerDetailPage({ params })).rejects.toThrow("NOT_FOUND");
  });
});
