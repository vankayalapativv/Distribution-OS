import { afterEach, describe, expect, it, vi } from "vitest";

const { sendWebPush } = vi.hoisted(() => ({ sendWebPush: vi.fn() }));
vi.mock("../lib/web-push", () => ({ sendWebPush }));

import {
  customerName, deleteWebPushSubscription, executiveFirstName, inr,
  notifyOfficeWebPush, pruneDeadWebPushSubscription, saveWebPushSubscription, vapidFromEnv,
} from "./web-push-notify";
import { makeSql, calledTag } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());
const VAPID = { publicKey: "pk", privateKey: "sk", subject: "mailto:x@y.z" };

describe("web-push-notify helpers", () => {
  it("vapidFromEnv null vs keys; inr formats", () => {
    expect(vapidFromEnv({} as never)).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "pk", VAPID_PRIVATE_KEY: "sk", VAPID_SUBJECT: "s" } as never)).toMatchObject({ publicKey: "pk" });
    expect(inr(1234567)).toBe("₹12,34,567");
  });
  it("save/delete/prune subscription run their queries", async () => {
    const s = makeSql(); await saveWebPushSubscription(s, "u1", { endpoint: "e", p256dh: "p", auth: "a" } as never);
    expect(calledTag(s, "upsert_web_push_subscription")).toBe(true);
    const d = makeSql(); await deleteWebPushSubscription(d, "u1", "e"); expect(calledTag(d, "delete_web_push_subscription")).toBe(true);
    const p = makeSql(); await pruneDeadWebPushSubscription(p, "e"); expect(calledTag(p, "prune_dead_web_push_subscription")).toBe(true);
  });
  it("customerName / executiveFirstName (null id, found, not-found)", async () => {
    expect(await customerName(makeSql(), null)).toBeNull();
    expect(await customerName(makeSql({ web_push_customer_name: [{ name: "Ravi" }] }), "c1")).toBe("Ravi");
    expect(await customerName(makeSql({ web_push_customer_name: [{ name: "" }] }), "c1")).toBeNull();
    expect(await executiveFirstName(makeSql(), null)).toBeNull();
    expect(await executiveFirstName(makeSql({ web_push_executive_first_name: [{ name: "Asha Kumar" }] }), "u1")).toBe("Asha");
  });
  it("notifyOfficeWebPush prunes gone endpoints and tolerates errors", async () => {
    sendWebPush.mockResolvedValueOnce({ status: 410 }).mockRejectedValueOnce(new Error("net"));
    const sql = makeSql({ office_web_push_subscriptions: [{ endpoint: "e1", p256dh: "p", auth: "a" }, { endpoint: "e2", p256dh: "p", auth: "a" }] });
    await notifyOfficeWebPush(sql, VAPID as never, { title: "T", body: "B", tag: "t" }, 123);
    expect(calledTag(sql, "prune_dead_web_push_subscription")).toBe(true);
  });
});
