import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, apiRequest, isNonRetryableStatus, type ActionConfig } from "./api-client";

const config: ActionConfig = { apiBaseUrl: "https://api.test", authToken: "tok" };

/** Override navigator.onLine (jsdom defaults it to true). */
function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  setOnline(true);
});

describe("apiRequest fix #1 — request timeout", () => {
  it("aborts a hung request after 15s and reports a timeout", async () => {
    vi.useFakeTimers();
    // A signal-aware fetch that never resolves until the request is aborted —
    // exactly how the browser's fetch behaves when the server hangs.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = apiRequest(config, "GET", "/slow");
    // Assert the rejection while the 15s timer fires.
    const assertion = expect(promise).rejects.toThrow(/taking too long to respond/i);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does NOT abort a response that returns before the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true, data: { ok: 1 } }), { status: 200 })),
    );
    const promise = apiRequest<{ ok: number }>(config, "GET", "/fast");
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toEqual({ ok: 1 });
  });
});

describe("apiRequest fix #2 — offline vs server-down vs http", () => {
  it("says 'offline' when the browser reports offline", async () => {
    setOnline(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(apiRequest(config, "GET", "/x")).rejects.toThrow(/you appear to be offline/i);
  });

  it("says 'can't reach the server' when online but fetch throws", async () => {
    setOnline(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(apiRequest(config, "GET", "/x")).rejects.toThrow(/can't reach the server/i);
  });

  it("passes through the API's own message on an HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Customer not found." } }), { status: 404 }),
      ),
    );
    await expect(apiRequest(config, "GET", "/x")).rejects.toThrow("Customer not found.");
  });

  it("throws an ApiRequestError carrying the HTTP status (so retry can act on 402)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Subscription payment required." } }), { status: 402 }),
      ),
    );
    await expect(apiRequest(config, "GET", "/x")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 402,
      message: "Subscription payment required.",
    });
  });
});

describe("isNonRetryableStatus", () => {
  it("is true for auth/billing/missing/validation (a retry can't fix these)", () => {
    for (const s of [401, 402, 403, 404, 422]) expect(isNonRetryableStatus(s)).toBe(true);
  });
  it("is false for transient/server errors that a retry might fix", () => {
    for (const s of [500, 502, 503, 504, 429]) expect(isNonRetryableStatus(s)).toBe(false);
  });
  it("ApiRequestError is a real Error subclass", () => {
    const e = new ApiRequestError("nope", 402);
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(402);
  });
});

describe("apiRequest fix #3 — silent token refresh on 401", () => {
  it("on 401, mints a fresh token from /api/auth/token and retries once with it", async () => {
    const calls: Array<{ url: string; auth?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        calls.push({ url, auth });
        if (url === "/api/auth/token") {
          return new Response(JSON.stringify({ token: "fresh-token" }), { status: 200 });
        }
        // The API 401s with the stale token, succeeds with the refreshed one.
        return auth === "Bearer fresh-token"
          ? new Response(JSON.stringify({ success: true, data: { ok: 9 } }), { status: 200 })
          : new Response(JSON.stringify({ error: { message: "Authentication context is required." } }), { status: 401 });
      }),
    );

    const data = await apiRequest<{ ok: number }>(config, "GET", "/thing");
    expect(data).toEqual({ ok: 9 });
    // Exactly: API(401) → refresh → API(200) — one retry, one refresh.
    expect(calls.map((c) => c.url)).toEqual(["https://api.test/thing", "/api/auth/token", "https://api.test/thing"]);
    expect(calls[2].auth).toBe("Bearer fresh-token");
  });

  it("when the refresh also fails (session gone), throws session-expired and redirects to /login", async () => {
    const loc = { href: "" };
    Object.defineProperty(window, "location", { configurable: true, value: loc });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/auth/token"
          ? new Response(JSON.stringify({ error: "Session expired." }), { status: 401 })
          : new Response(JSON.stringify({ error: { message: "Authentication context is required." } }), { status: 401 }),
      ),
    );

    await expect(apiRequest(config, "GET", "/thing")).rejects.toMatchObject({
      status: 401,
      message: /session has expired/i,
    });
    expect(loc.href).toBe("/login");
  });
});
