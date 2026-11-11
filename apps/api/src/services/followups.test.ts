import { describe, expect, it } from "vitest";
import type { SqlClient } from "../lib/db";
import {
  createCheckoutFollowup,
  getLatestOpenFollowup,
  resolveLatestOpenForCustomer,
  runFollowupReminders,
} from "./followups";

/** A tagged-template SQL spy: records each query's /* comment *​/ + values and
 *  returns whatever `responder` gives for that comment. */
function fakeSql(responder: (comment: string, values: unknown[]) => unknown[]) {
  const calls: { comment: string; values: unknown[] }[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ");
    const comment = text.match(/\/\*\s*([^*]+?)\s*\*\//)?.[1]?.trim() ?? "";
    calls.push({ comment, values });
    return Promise.resolve(responder(comment, values));
  };
  return { sql: sql as unknown as SqlClient, calls };
}

describe("followups service", () => {
  it("createCheckoutFollowup supersedes the prior open one, then inserts", async () => {
    const { sql, calls } = fakeSql(() => []);
    await createCheckoutFollowup(sql, {
      customerId: "c1",
      createdBy: "u1",
      visitId: "v1",
      reason: "next week payment",
      followUpAt: "2026-10-20T04:30:00.000Z",
    });
    expect(calls.map((c) => c.comment)).toEqual(["supersede_open_followups", "insert_followup"]);
    // The insert carries the reason + the picked follow-up time.
    expect(calls[1].values).toContain("next week payment");
    expect(calls[1].values).toContain("2026-10-20T04:30:00.000Z");
  });

  it("createCheckoutFollowup allows a null follow-up time (context-only)", async () => {
    const { sql, calls } = fakeSql(() => []);
    await createCheckoutFollowup(sql, {
      customerId: "c1",
      createdBy: "u1",
      visitId: "v1",
      reason: "shop closed today",
      followUpAt: null,
    });
    expect(calls[1].values).toContain(null);
  });

  it("resolveLatestOpenForCustomer returns the mapped resolved row", async () => {
    const { sql } = fakeSql((comment) =>
      comment === "resolve_latest_open_followup"
        ? [
            {
              id: "f1",
              customerId: "c1",
              reason: "next week",
              followUpAt: new Date("2026-10-20T04:30:00.000Z"),
              status: "done",
              createdAt: new Date("2026-10-14T00:00:00.000Z"),
            },
          ]
        : [],
    );
    const res = await resolveLatestOpenForCustomer(sql, { customerId: "c1", userId: "u1" });
    expect(res).toMatchObject({ id: "f1", status: "done", followUpAt: "2026-10-20T04:30:00.000Z" });
  });

  it("resolveLatestOpenForCustomer returns null when nothing is open", async () => {
    const { sql } = fakeSql(() => []);
    expect(await resolveLatestOpenForCustomer(sql, { customerId: "c1", userId: "u1" })).toBeNull();
  });

  it("runFollowupReminders pushes a due follow-up, marks it notified, feeds the SE", async () => {
    const { sql, calls } = fakeSql((comment) => {
      if (comment === "due_followups")
        return [{ id: "f1", seId: "u1", customerId: "c1", reason: "next week payment", customerName: "Raj Motors" }];
      if (comment === "followup_push_tokens") return [{ userId: "u1", token: "ExpoTok1" }];
      return [];
    });
    const res = await runFollowupReminders(sql, "2026-10-20T05:00:00.000Z");
    expect(res.notified).toBe(1);
    expect(res.pushes).toEqual([
      { tokens: ["ExpoTok1"], title: "Follow up: Raj Motors", body: expect.stringContaining("next week payment") },
    ]);
    expect(calls.map((c) => c.comment)).toEqual([
      "due_followups",
      "mark_followups_notified",
      "followup_due_notifications",
      "followup_push_tokens",
    ]);
  });

  it("runFollowupReminders no-ops (only the scan query) when nothing is due", async () => {
    const { sql, calls } = fakeSql(() => []);
    expect(await runFollowupReminders(sql, "2026-10-20T05:00:00.000Z")).toEqual({ notified: 0, pushes: [] });
    expect(calls.map((c) => c.comment)).toEqual(["due_followups"]);
  });

  it("runFollowupReminders still notifies/feeds when the SE has no push token (no push)", async () => {
    const { sql } = fakeSql((comment) =>
      comment === "due_followups"
        ? [{ id: "f1", seId: "u1", customerId: "c1", reason: "pay friday", customerName: "X" }]
        : [],
    );
    const res = await runFollowupReminders(sql, "2026-10-20T05:00:00.000Z");
    expect(res.notified).toBe(1);
    expect(res.pushes).toHaveLength(0);
  });

  it("getLatestOpenFollowup maps the open row (or null)", async () => {
    const { sql } = fakeSql((comment) =>
      comment === "latest_open_followup"
        ? [
            {
              id: "f2",
              customerId: "c1",
              reason: "payment evening",
              followUpAt: null,
              status: "open",
              createdAt: new Date("2026-10-14T00:00:00.000Z"),
            },
          ]
        : [],
    );
    expect(await getLatestOpenFollowup(sql, "c1")).toMatchObject({ id: "f2", status: "open", followUpAt: null });
  });
});
