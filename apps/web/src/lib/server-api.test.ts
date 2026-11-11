import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serverApiFetch } from "./server-api";

// Force the local-dev public-fetch path with a single fixed base, so the mocked
// global fetch is what serverApiFetch calls (the service binding is absent here).
beforeEach(() => {
  vi.stubEnv("DISTRIBUTION_OS_API_BASE_URL", "http://api.test/api/v1");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200 });

describe("serverApiFetch fix #3 — bounded retry on idempotent reads", () => {
  it("retries a GET through two 5xx blips and returns the eventual 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(ok({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await serverApiFetch("/customers");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a GET through a thrown fetch, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(ok({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await serverApiFetch("/customers");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 attempts and returns the last 5xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await serverApiFetch("/customers");
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a write (POST) — one attempt only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await serverApiFetch("/collections", { method: "POST" });
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 4xx — a client error won't fix itself", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await serverApiFetch("/customers");
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out a hung request instead of freezing the render", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // A write → single attempt, so the 10s timeout fires exactly once.
    const promise = serverApiFetch("/collections", { method: "POST" });
    let settled = false;
    void promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    const assertion = expect(promise).rejects.toThrow();

    // Still hanging just before the ceiling…
    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);
    // …the 10s timeout aborts it, so the render fails fast instead of freezing.
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
