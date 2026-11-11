import { describe, expect, it, vi } from "vitest";
import { defaultIsRetryable, submitWrite } from "./online-first";

describe("defaultIsRetryable", () => {
  it("retries network/timeout errors (no HTTP status)", () => {
    expect(defaultIsRetryable(new Error("Network request failed"))).toBe(true);
    expect(defaultIsRetryable(undefined)).toBe(true);
    expect(defaultIsRetryable({ status: "nope" })).toBe(true);
  });

  it("retries 401 / 408 / 429 and any 5xx", () => {
    for (const status of [401, 408, 429, 500, 503]) {
      expect(defaultIsRetryable({ status })).toBe(true);
    }
  });

  it("does NOT retry a permanent 4xx (validation / not found)", () => {
    for (const status of [400, 404, 409, 422]) {
      expect(defaultIsRetryable({ status })).toBe(false);
    }
  });
});

describe("submitWrite (online-first with fallback)", () => {
  it("sends to the server and returns 'sent' with the server data", async () => {
    const send = vi.fn().mockResolvedValue({ id: "run-1" });
    const queue = vi.fn();
    const res = await submitWrite({ send, queue });
    expect(res).toEqual({ status: "sent", data: { id: "run-1" } });
    expect(queue).not.toHaveBeenCalled(); // never touched local storage while online
  });

  it("on a retryable failure, falls back to the local queue → 'queued'", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const queue = vi.fn();
    const res = await submitWrite({ send, queue });
    expect(res).toEqual({ status: "queued" });
    expect(queue).toHaveBeenCalledOnce();
  });

  it("when offline AND the local DB is broken (queue throws) → 'unsaved'", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const queue = vi.fn(() => {
      throw new Error("attempt to write a readonly database");
    });
    const res = await submitWrite({ send, queue });
    expect(res).toEqual({ status: "unsaved", reason: "storage" });
  });

  it("on a permanent server error (4xx), rejects WITHOUT queueing", async () => {
    const error = { status: 422, message: "bad" };
    const send = vi.fn().mockRejectedValue(error);
    const queue = vi.fn();
    const res = await submitWrite({ send, queue });
    expect(res).toEqual({ status: "rejected", error });
    expect(queue).not.toHaveBeenCalled();
  });

  it("respects a custom isRetryable predicate", async () => {
    const error = { status: 500 };
    const send = vi.fn().mockRejectedValue(error);
    const queue = vi.fn();
    // treat everything as permanent → should reject, not queue
    const res = await submitWrite({ send, queue, isRetryable: () => false });
    expect(res).toEqual({ status: "rejected", error });
    expect(queue).not.toHaveBeenCalled();
  });
});
