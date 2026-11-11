import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SqlClient } from "../lib/db";
import type { ApiEnv } from "../types";

const svc = vi.hoisted(() => ({ getBillingAccess: vi.fn() }));
vi.mock("./billing-v2", async (importActual) => {
  const actual = await importActual<typeof import("./billing-v2")>();
  return { ...actual, getBillingAccess: svc.getBillingAccess };
});

import { runBillingReminders } from "./billing-reminders";

/**
 * Fake `sql` tag. `markFresh` controls whether markOnce "inserts" (returns a row).
 * `day` is what the IST day-of-month query returns. Records sent markers.
 */
function fakeSql(opts: { admins?: string[]; day?: number; markFresh?: boolean }) {
  const marks: string[] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = strings.join(" ");
    if (q.includes("billing_reminder_admins")) {
      return Promise.resolve((opts.admins ?? ["admin@x.com"]).map((email) => ({ email })));
    }
    if (q.includes("billing_reminder_day")) return Promise.resolve([{ day: opts.day ?? 1 }]);
    if (q.includes("billing_reminder_mark")) {
      marks.push(String(values[0]));
      return Promise.resolve(opts.markFresh === false ? [] : [{ key: values[0] }]);
    }
    return Promise.resolve([]);
  };
  return { sql: tag as unknown as SqlClient, marks };
}

const env = { RESEND_API_KEY: "re_test", REPORTS_WEB_BASE_URL: "https://app.test" } as ApiEnv["Bindings"];

const pendingCharge = {
  current: { periodStart: "2026-11-01", amountPaisa: 70800 * 3, seats: 3, status: "pending" },
};

beforeEach(() => {
  svc.getBillingAccess.mockReset();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
});
afterEach(() => vi.restoreAllMocks());

describe("runBillingReminders", () => {
  test("no-op without RESEND_API_KEY", async () => {
    svc.getBillingAccess.mockResolvedValue(pendingCharge);
    const { sql } = fakeSql({});
    const r = await runBillingReminders(sql, {} as ApiEnv["Bindings"]);
    expect(r.sent).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("free/paid month → nothing sent", async () => {
    svc.getBillingAccess.mockResolvedValue({ current: { status: "free", periodStart: "2026-10-01", amountPaisa: 0, seats: 0 } });
    const { sql } = fakeSql({});
    const r = await runBillingReminders(sql, env);
    expect(r.sent).toEqual([]);
  });

  test("pending on the 1st → sends the DUE email once", async () => {
    svc.getBillingAccess.mockResolvedValue(pendingCharge);
    const { sql } = fakeSql({ day: 1, markFresh: true });
    const r = await runBillingReminders(sql, env);
    expect(r.sent).toContain("due");
    expect(r.sent).not.toContain("grace"); // day 1 < grace day
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("pending on day 7 → sends BOTH due and grace (fresh markers)", async () => {
    svc.getBillingAccess.mockResolvedValue(pendingCharge);
    const { sql } = fakeSql({ day: 7, markFresh: true });
    const r = await runBillingReminders(sql, env);
    expect(r.sent).toEqual(["due", "grace"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("markers already set → sends nothing (idempotent)", async () => {
    svc.getBillingAccess.mockResolvedValue(pendingCharge);
    const { sql } = fakeSql({ day: 7, markFresh: false });
    const r = await runBillingReminders(sql, env);
    expect(r.sent).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("no admin emails → nothing sent", async () => {
    svc.getBillingAccess.mockResolvedValue(pendingCharge);
    const { sql } = fakeSql({ admins: [] });
    const r = await runBillingReminders(sql, env);
    expect(r.sent).toEqual([]);
  });
});
