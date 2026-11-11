import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

// Neon driver mock: the v2 idempotency insert returns a row (fresh event); the
// mark-paid finds no matching charge (empty); other queries empty.
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const sql = async (strings: TemplateStringsArray) => {
      const q = strings.join(" ");
      if (q.includes("billing_v2_event_once")) return [{ event_id: "evt-row" }];
      return [];
    };
    // applyPaymentWebhook settles inside sql.transaction([...]); resolve each
    // statement to its mocked rows, mirroring the Neon batch-transaction shape.
    (sql as unknown as { transaction: (s: unknown[]) => Promise<unknown[]> }).transaction = (stmts) =>
      Promise.all(stmts as Promise<unknown>[]);
    return sql;
  },
}));

import { razorpayWebhookRoutes } from "./razorpay-webhook";
import type { ApiEnv } from "../types";

const SECRET = "whsec_test_route";
const env = {
  RAZORPAY_WEBHOOK_SECRET: SECRET,
  DATABASE_URL: "postgres://example/db",
  GRACE_PERIOD_HOURS: "168",
} as ApiEnv["Bindings"];

// Wrap so requestId is set (the global middleware isn't present in this isolated app).
const app = new Hono<ApiEnv>();
app.use("*", async (c, next) => {
  c.set("requestId", "test-req");
  await next();
});
app.route("/", razorpayWebhookRoutes);

const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

function post(body: string, headers: Record<string, string>) {
  return app.request(
    "/razorpay",
    { method: "POST", headers: { "content-type": "application/json", ...headers }, body },
    env,
  );
}

const BODY = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_1", order_id: "order_1", created_at: 1_800_000_000 } } },
});

describe("POST /webhooks/razorpay", () => {
  it("rejects an invalid signature with 400", async () => {
    const res = await post(BODY, { "x-razorpay-signature": "deadbeef", "x-razorpay-event-id": "evt_1" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing signature with 400", async () => {
    const res = await post(BODY, { "x-razorpay-event-id": "evt_1" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing event id with 400", async () => {
    const res = await post(BODY, { "x-razorpay-signature": sign(BODY) });
    expect(res.status).toBe(400);
  });

  it("accepts a correctly signed event with 200", async () => {
    const res = await post(BODY, { "x-razorpay-signature": sign(BODY), "x-razorpay-event-id": "evt_ok" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });
});
