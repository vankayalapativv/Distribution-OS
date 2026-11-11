#!/usr/bin/env node
/**
 * Send a correctly-signed fake Razorpay subscription webhook to a running Worker
 * so every lifecycle event / edge case can be simulated without waiting a month.
 *
 * Reads RAZORPAY_WEBHOOK_SECRET from the environment or the repo-root .env.
 *
 * Usage:
 *   node scripts/razorpay-fake-webhook.mjs <event> [options]
 *
 *   event   one of: subscription.activated | subscription.charged |
 *           subscription.pending | subscription.halted | subscription.cancelled |
 *           subscription.completed | subscription.updated | payment.failed
 *
 * Options:
 *   --sub=sub_XXXX        subscription id            (default sub_TEST0001)
 *   --status=active       entity.status             (default: derived from event)
 *   --qty=8               entity.quantity           (default 8)
 *   --start=now           current_start (now | epoch seconds | +Nd/+Nh/+Nm)
 *   --end=+30d            current_end   (epoch seconds | +Nd/+Nh/+Nm)  (default +30d)
 *   --event-id=evt_x      x-razorpay-event-id       (default: random)
 *   --url=...             webhook URL (default http://localhost:8787/api/v1/webhooks/razorpay)
 *
 * Example — activate then simulate a failed renewal:
 *   node scripts/razorpay-fake-webhook.mjs subscription.activated --sub=sub_TEST1 --end=+30d
 *   node scripts/razorpay-fake-webhook.mjs subscription.pending   --sub=sub_TEST1
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const txt = readFileSync(join(ROOT, ".env"), "utf8");
    const m = txt.match(new RegExp(`^${name}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

function parseTime(v, fallbackSec) {
  if (v == null) return fallbackSec;
  if (v === "now") return Math.floor(Date.now() / 1000);
  const rel = /^\+(\d+)([dhm])$/.exec(v);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2] === "d" ? 86400 : rel[2] === "h" ? 3600 : 60;
    return Math.floor(Date.now() / 1000) + n * unit;
  }
  return Number(v);
}

const DEFAULT_STATUS = {
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "completed",
  "subscription.updated": "active",
  "payment.failed": "active",
};

function arg(flag, def) {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : def;
}

async function main() {
  const event = process.argv[2];
  if (!event || !(event in DEFAULT_STATUS)) {
    console.error("Provide a valid event, e.g. subscription.activated. See file header.");
    process.exit(1);
  }
  const secret = loadEnv("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET not found in env or .env");
    process.exit(1);
  }

  const url = arg("--url", "http://localhost:8787/api/v1/webhooks/razorpay");
  const subId = arg("--sub", "sub_TEST0001");
  const status = arg("--status", DEFAULT_STATUS[event]);
  const quantity = Number(arg("--qty", "8"));
  const currentStart = parseTime(arg("--start", "now"), Math.floor(Date.now() / 1000));
  const currentEnd = parseTime(arg("--end", "+30d"), Math.floor(Date.now() / 1000) + 30 * 86400);
  const eventId = arg("--event-id", `evt_${randomUUID()}`);

  const entity = {
    id: subId,
    status,
    quantity,
    current_start: currentStart,
    current_end: currentEnd,
    plan_id: loadEnv("RAZORPAY_PLAN_ID") ?? "plan_TEST",
  };
  const payload = {
    entity: "event",
    event,
    created_at: Math.floor(Date.now() / 1000),
    payload:
      event === "payment.failed"
        ? { payment: { entity: { id: `pay_${randomUUID().slice(0, 8)}`, subscription_id: subId } } }
        : { subscription: { entity } },
  };

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body,
  });
  const text = await res.text();
  console.log(`→ ${event}  sub=${subId}  end=${new Date(currentEnd * 1000).toISOString()}  event-id=${eventId}`);
  console.log(`← ${res.status} ${text}`);
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
