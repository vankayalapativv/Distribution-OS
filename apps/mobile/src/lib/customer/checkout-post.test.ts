import { afterEach, describe, expect, it, vi } from "vitest";
import { postCheckout } from "./checkout-post";
import { ApiRequestError } from "../api-core";
import type { CheckOutOpts, Fix } from "./checkout-types";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const captureNoOutcome = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
const mirrorFollowup = vi.fn();
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./checkout-helpers", () => ({
  captureNoOutcome: (...a: unknown[]) => captureNoOutcome(...a),
  mirrorFollowup: (...a: unknown[]) => mirrorFollowup(...a),
}));

const fix: Fix = { latitude: 17.4, longitude: 78.5, accuracy: 8 };
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const opts = { token: "tok", confirm, promptReason: vi.fn(), pickDateTime: vi.fn() } as unknown as CheckOutOpts;
const err = (code: string) => new ApiRequestError(code, `${code} msg`, 409);
afterEach(() => vi.clearAllMocks());

describe("postCheckout success", () => {
  it("posts a bare checkout and does not mirror when there's no captured reason", async () => {
    expect(await postCheckout(opts, "s1", fix, null)).toBe(true);
    const body = (apiFetch.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toEqual({ latitude: 17.4, longitude: 78.5, accuracy: 8 });
    expect(mirrorFollowup).not.toHaveBeenCalled();
  });
  it("includes reason + followUpAt and mirrors the follow-up", async () => {
    const captured = { reason: "pay later", followUpAt: "2026-12-01T09:00:00.000Z" };
    expect(await postCheckout(opts, "s1", fix, captured)).toBe(true);
    const body = (apiFetch.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ reason: "pay later", followUpAt: "2026-12-01T09:00:00.000Z" });
    expect(mirrorFollowup).toHaveBeenCalledWith(opts, captured);
  });
  it("omits followUpAt when the reminder was skipped", async () => {
    expect(await postCheckout(opts, "s1", fix, { reason: "no stock", followUpAt: null })).toBe(true);
    const body = (apiFetch.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("followUpAt");
    expect(body).toHaveProperty("reason", "no stock");
  });
});

describe("postCheckout error handling", () => {
  it("treats CONFLICT as already-done", async () => {
    apiFetch.mockRejectedValueOnce(err("CONFLICT"));
    expect(await postCheckout(opts, "s1", fix, null)).toBe(true);
  });
  it("captures a reason on NO_OUTCOME_REASON and retries once", async () => {
    apiFetch.mockRejectedValueOnce(err("NO_OUTCOME_REASON")).mockResolvedValueOnce({});
    const next = { reason: "pay next week", followUpAt: null };
    captureNoOutcome.mockResolvedValue(next);
    expect(await postCheckout(opts, "s1", fix, null)).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(mirrorFollowup).toHaveBeenCalledWith(opts, next);
  });
  it("stops when the SE cancels the NO_OUTCOME_REASON prompt", async () => {
    apiFetch.mockRejectedValueOnce(err("NO_OUTCOME_REASON"));
    captureNoOutcome.mockResolvedValue(null);
    expect(await postCheckout(opts, "s1", fix, null)).toBe(false);
  });
  it("re-throws NO_OUTCOME_REASON when a reason was already supplied", async () => {
    apiFetch.mockRejectedValueOnce(err("NO_OUTCOME_REASON"));
    await expect(postCheckout(opts, "s1", fix, { reason: "r", followUpAt: null })).rejects.toThrow("NO_OUTCOME_REASON");
  });
  it("prompts and stops on OUT_OF_RANGE", async () => {
    apiFetch.mockRejectedValueOnce(err("OUT_OF_RANGE"));
    expect(await postCheckout(opts, "s1", fix, null)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Too far from the shop" }));
  });
  it("re-throws an unknown server code", async () => {
    apiFetch.mockRejectedValueOnce(err("TEAPOT"));
    await expect(postCheckout(opts, "s1", fix, null)).rejects.toThrow("TEAPOT");
  });
  it("re-throws a non-API error", async () => {
    apiFetch.mockRejectedValueOnce(new Error("network"));
    await expect(postCheckout(opts, "s1", fix, null)).rejects.toThrow("network");
  });
});
