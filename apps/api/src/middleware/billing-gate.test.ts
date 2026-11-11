import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiEnv } from "../types";

const svc = vi.hoisted(() => ({ getBillingAccess: vi.fn() }));
vi.mock("../services/billing-v2", () => ({
  getBillingAccess: svc.getBillingAccess,
  // Enforcement is on by default; off only when BILLING_ENFORCED === "false".
  isBillingEnforced: (env: { BILLING_ENFORCED?: string }) => env.BILLING_ENFORCED !== "false",
}));
vi.mock("../lib/db", () => ({ getSqlClient: () => ({}) }));

import { billingGate } from "./billing-gate";

function makeApp() {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => {
    c.set("requestId", "t");
    await next();
  });
  app.use("*", billingGate);
  app.get("/customers", (c) => c.text("ok"));
  app.get("/billing/status", (c) => c.text("billing"));
  app.get("/me", (c) => c.text("me"));
  app.get("/me/tasks", (c) => c.text("tasks"));
  app.get("/me/notifications", (c) => c.text("notifications"));
  return app;
}

beforeEach(() => svc.getBillingAccess.mockReset());

describe("billingGate", () => {
  it("is a no-op only when BILLING_ENFORCED is 'false'", async () => {
    const res = await makeApp().request("/customers", {}, { BILLING_ENFORCED: "false" } as ApiEnv["Bindings"]);
    expect(res.status).toBe(200);
    expect(svc.getBillingAccess).not.toHaveBeenCalled();
  });

  it("is enforced by default (flag unset) — 402 when blocked", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: true, reason: "grace-expired", accessUntilMs: 0 });
    const res = await makeApp().request("/customers", {}, {} as ApiEnv["Bindings"]);
    expect(res.status).toBe(402);
  });

  // Note: the gate also FAILS OPEN if getBillingAccess throws (wrapped in try/catch
  // → next()), so a transient DB error never 402-bricks the app. Not unit-tested
  // here because a throwing mock trips vitest's unhandled-rejection detector.

  it("returns 402 for app routes when the org is blocked", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: true, reason: "grace-expired", accessUntilMs: 0 });
    const res = await makeApp().request("/customers", {}, { BILLING_ENFORCED: "true" } as ApiEnv["Bindings"]);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("BILLING_BLOCKED");
  });

  it("never blocks billing routes even when blocked", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: true, reason: "grace-expired", accessUntilMs: 0 });
    const res = await makeApp().request("/billing/status", {}, { BILLING_ENFORCED: "true" } as ApiEnv["Bindings"]);
    expect(res.status).toBe(200);
  });

  it("allows app routes when not blocked", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: false, reason: "ok", accessUntilMs: null });
    const res = await makeApp().request("/customers", {}, { BILLING_ENFORCED: "true" } as ApiEnv["Bindings"]);
    expect(res.status).toBe(200);
  });

  it("keeps the /me identity read reachable while blocked (UI must bootstrap)", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: true, reason: "grace-expired", accessUntilMs: 0 });
    const res = await makeApp().request("/me", {}, { BILLING_ENFORCED: "true" } as ApiEnv["Bindings"]);
    expect(res.status).toBe(200);
    expect(svc.getBillingAccess).not.toHaveBeenCalled(); // exact-exempt, gate not consulted
  });

  it("blocks /me DATA routes when blocked (no data leak through the /me namespace)", async () => {
    svc.getBillingAccess.mockResolvedValue({ blocked: true, reason: "grace-expired", accessUntilMs: 0 });
    const app = makeApp();
    for (const path of ["/me/tasks", "/me/notifications"]) {
      const res = await app.request(path, {}, { BILLING_ENFORCED: "true" } as ApiEnv["Bindings"]);
      expect(res.status).toBe(402);
    }
  });
});
