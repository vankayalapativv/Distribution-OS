import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENV, headers, installAuth } from "../test/route-harness";

const H = vi.hoisted(() => ({ responses: {} as Record<string, unknown[]> }));
vi.mock("@neondatabase/serverless", async () => {
  const { makeNeon } = await import("../test/route-harness");
  return { neon: () => makeNeon(() => H.responses) };
});

beforeEach(() => {
  vi.resetModules();
  H.responses = { list_brands_oils: [{ name: "Fuchs" }, { name: "Savsol" }] };
  installAuth();
});

describe("GET /brands", () => {
  it("returns live brand names for an office role", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/brands?category=oils", { headers: headers("superAdmin") }, ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toEqual(["Fuchs", "Savsol"]);
  });

  it("422s an invalid category", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/brands?category=bearings", { headers: headers("manager") }, ENV);
    expect(res.status).toBe(422);
  });

  it("403s a sales executive", async () => {
    const { default: app } = await import("../index");
    const res = await app.request("/api/v1/brands?category=oils", { headers: headers("se") }, ENV);
    expect(res.status).toBe(403);
  });
});
