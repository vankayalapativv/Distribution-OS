import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./sync-core.test-support";
import { sendItem } from "./sync-send";
import { SyncHttpError, type SyncEntityType, type SyncQueueItem } from "./sync-core";

const apiFetch = vi.fn();
const sendCollection = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const sendDeliveryStart = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const sendDeliveryStop = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const sendDeliveryEnd = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
let db = freshDb();

vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./api-core", () => {
  class ApiRequestError extends Error {
    constructor(public code: string, message: string, public status: number) { super(message); }
  }
  return { ApiRequestError };
});
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
vi.mock("./db", () => ({ getLocalDb: () => db }));
vi.mock("./sync-send-collection", () => ({ sendCollection: (...a: unknown[]) => sendCollection(...a) }));
vi.mock("./sync-send-delivery", () => ({
  sendDeliveryStart: (...a: unknown[]) => sendDeliveryStart(...a),
  sendDeliveryEnd: (...a: unknown[]) => sendDeliveryEnd(...a),
}));
vi.mock("./sync-send-delivery-stop", () => ({ sendDeliveryStop: (...a: unknown[]) => sendDeliveryStop(...a) }));

function item(entityType: SyncEntityType, clientUuid = "u1"): SyncQueueItem {
  return { id: 1, clientUuid, entityType, payload: { x: 1 }, attempts: 0 };
}

beforeEach(() => { db = freshDb(); apiFetch.mockResolvedValue({ ok: true }); });
afterEach(() => vi.clearAllMocks());

describe("sendItem dispatch", () => {
  it("POSTs a visit check-in", async () => {
    await sendItem(item("visit_checkin"));
    expect(apiFetch).toHaveBeenCalledWith("/visits/checkin", { method: "POST", body: { x: 1 }, token: "tok" });
  });

  it("POSTs an order", async () => {
    await sendItem(item("order"));
    expect(apiFetch).toHaveBeenCalledWith("/orders", { method: "POST", body: { x: 1 }, token: "tok" });
  });

  it("routes collection + delivery entities to their senders", async () => {
    await sendItem(item("collection"));
    await sendItem(item("delivery_start"));
    await sendItem(item("delivery_stop"));
    await sendItem(item("delivery_end"));
    expect(sendCollection).toHaveBeenCalled();
    expect(sendDeliveryStart).toHaveBeenCalled();
    expect(sendDeliveryStop).toHaveBeenCalled();
    expect(sendDeliveryEnd).toHaveBeenCalled();
  });

  it("parks an unsupported entity as a permanent 4xx", async () => {
    await expect(sendItem(item("task_done"))).rejects.toMatchObject({ status: 400 });
  });

  describe("visit_checkout", () => {
    it("defers until the check-in's server id is known", async () => {
      db.run("insert into visits (client_uuid, created_at) values ('u1', 1)"); // server_id null
      await expect(sendItem(item("visit_checkout"))).rejects.toBeInstanceOf(SyncHttpError);
    });
    it("POSTs the checkout against the resolved server id", async () => {
      db.run("insert into visits (client_uuid, server_id, created_at) values ('u1', 'srv-v1', 1)");
      await sendItem(item("visit_checkout"));
      expect(apiFetch).toHaveBeenCalledWith("/visits/srv-v1/checkout", { method: "POST", body: { x: 1 }, token: "tok" });
    });
  });

  describe("error mapping", () => {
    it("maps an ApiRequestError to a SyncHttpError with the same status", async () => {
      const { ApiRequestError } = await import("./api-core");
      apiFetch.mockRejectedValue(new ApiRequestError("BAD", "not found", 404));
      await expect(sendItem(item("order"))).rejects.toMatchObject({ status: 404 });
    });
    it("rethrows a network failure unchanged (retryable)", async () => {
      apiFetch.mockRejectedValue(new Error("network"));
      await expect(sendItem(item("order"))).rejects.toThrow("network");
    });
  });
});
