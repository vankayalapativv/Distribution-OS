import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => ({})) };
});
vi.mock("../services/customers-shared", () => ({ assertCustomerVisible: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/followups", () => ({
  getLatestOpenFollowup: vi.fn().mockResolvedValue({ id: "f1", status: "open" }),
  resolveLatestOpenForCustomer: vi.fn().mockResolvedValue({ id: "f1", status: "done" }),
}));

beforeEach(() => { vi.resetModules(); installAuth(); });

describe("followups routes", () => {
  it("GET /customers/:id returns the latest open follow-up", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/followups/customers/c1", { headers: headers("se") }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.followup.id).toBe("f1");
  });
  it("POST /customers/:id/resolve resolves it", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/followups/customers/c1/resolve", { method: "POST", headers: { ...headers("se"), "content-type": "application/json" }, body: "{}" }, ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).data.followup.status).toBe("done");
  });
});
