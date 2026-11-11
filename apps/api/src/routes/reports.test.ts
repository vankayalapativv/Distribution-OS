import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/reports", () => ({
  isReportKey: (k: string) => k === "collections",
  buildOneReport: vi.fn().mockResolvedValue({ report: "collections" }),
  buildSummary: vi.fn().mockResolvedValue({ summary: true }),
  buildBrandsSummary: vi.fn().mockResolvedValue({ brands: [] }),
}));
vi.mock("../services/profit", () => ({
  profitReport: vi.fn().mockResolvedValue({ groupBy: "customer", totals: { profit: 1234 }, rows: [] }),
}));

beforeEach(() => { vi.resetModules(); installAuth(); });

describe("reports routes", () => {
  it("GET / default → summary", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/reports?cadence=weekly", { headers: headers("manager") }, ENV)).status).toBe(200);
  });
  it("GET /?report=<key> → one report", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/reports?report=collections&from=2026-06-01&to=2026-06-30&brand=Fuchs", { headers: headers("superAdmin") }, ENV);
    expect((await res.json()).data.report).toBe("collections");
  });
  it("GET /brands-summary", async () => {
    const { default: app } = await import("../index");
    expect((await app.request("/api/v1/reports/brands-summary?cadence=bogus", { headers: headers("accountant") }, ENV)).status).toBe(200);
  });
  it("GET /profit → profitability report", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/reports/profit?groupBy=customer&from=2026-04-01&to=2026-04-30", { headers: headers("manager") }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.totals.profit).toBe(1234);
  });
});
