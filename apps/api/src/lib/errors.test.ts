import { afterEach, describe, expect, it, vi } from "vitest";

const { captureError, capturePostHogException } = vi.hoisted(() => ({
  captureError: vi.fn().mockResolvedValue(undefined),
  capturePostHogException: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/errors", () => ({ captureError }));
vi.mock("./posthog", () => ({ capturePostHogException }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => vi.fn() }));

import { ApiError, errorHandler, notFoundHandler } from "./errors";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

function ctx(opts: { executionCtx?: unknown; databaseUrl?: string | undefined } = {}) {
  const json = vi.fn((body: unknown, status?: number) => ({ body, status }));
  const c = {
    env: { DATABASE_URL: "databaseUrl" in opts ? opts.databaseUrl : "postgres://x", ENVIRONMENT: "production" },
    req: { path: "/api/v1/orders", method: "POST" },
    var: { requestId: "r", auth: { userId: "u", role: "MANAGER" } },
    executionCtx: opts.executionCtx,
    json,
  } as unknown as Context<ApiEnv>;
  return { c, json };
}

afterEach(() => vi.clearAllMocks());

describe("notFoundHandler", () => {
  it("returns a 404 failure naming the route", () => {
    const { c, json } = ctx();
    notFoundHandler(c);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "NOT_FOUND" }) }), 404);
  });
});

describe("errorHandler", () => {
  it("returns a 4xx ApiError without monitoring it", () => {
    const { c, json } = ctx({ executionCtx: { waitUntil: vi.fn() } });
    errorHandler(new ApiError("INVALID_FIELD", "bad", 422), c);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "INVALID_FIELD" }) }), 422);
    expect(captureError).not.toHaveBeenCalled();
    expect(capturePostHogException).not.toHaveBeenCalled();
  });

  it("monitors a 5xx ApiError (PostHog + in-house) and returns it", () => {
    const waitUntil = vi.fn((p) => p);
    const { c, json } = ctx({ executionCtx: { waitUntil } });
    errorHandler(new ApiError("SERVICE_UNAVAILABLE", "down", 503), c);
    expect(json).toHaveBeenCalledWith(expect.anything(), 503);
    expect(capturePostHogException).toHaveBeenCalledOnce();
    expect(captureError).toHaveBeenCalledOnce();
  });

  it("logs + monitors an unknown error and returns a generic 500", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { c, json } = ctx({ executionCtx: { waitUntil: vi.fn((p) => p) } });
    errorHandler(new Error("surprise"), c);
    expect(errSpy).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }) }), 500);
    expect(captureError).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });

  it("monitoring is a no-op when there is no executionCtx", () => {
    const { c } = ctx({ executionCtx: undefined });
    errorHandler(new ApiError("BOOM", "x", 500), c);
    expect(capturePostHogException).not.toHaveBeenCalled();
    expect(captureError).not.toHaveBeenCalled();
  });

  it("swallows a monitoring failure (waitUntil throws) and still returns the error", () => {
    const { c, json } = ctx({ executionCtx: { waitUntil: () => { throw new Error("wu down"); } } });
    expect(() => errorHandler(new ApiError("BOOM", "x", 500), c)).not.toThrow();
    expect(json).toHaveBeenCalledWith(expect.anything(), 500);
  });

  it("writes to PostHog but not the DB monitor when DATABASE_URL is unset", () => {
    const { c } = ctx({ executionCtx: { waitUntil: vi.fn((p) => p) }, databaseUrl: undefined });
    errorHandler(new ApiError("BOOM", "x", 500), c);
    expect(capturePostHogException).toHaveBeenCalledOnce();
    expect(captureError).not.toHaveBeenCalled();
  });

  it("swallows a DB-monitor write that rejects (never destabilises the response)", async () => {
    captureError.mockRejectedValueOnce(new Error("monitor db down"));
    const { c, json } = ctx({ executionCtx: { waitUntil: vi.fn((p) => p) } });
    errorHandler(new ApiError("SERVICE_UNAVAILABLE", "down", 503), c);
    await new Promise((r) => setTimeout(r, 0)); // let the .catch microtask run
    expect(captureError).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledWith(expect.anything(), 503);
  });
});
