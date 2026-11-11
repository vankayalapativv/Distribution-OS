import { afterEach, describe, expect, it, vi } from "vitest";

const { captureError } = vi.hoisted(() => ({ captureError: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/errors", () => ({ captureError }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => vi.fn() }));

import { waitUntilSafe } from "./wait-until";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

function ctx(opts: { executionCtx?: unknown; databaseUrl?: string | undefined } = {}): Context<ApiEnv> {
  return {
    env: { DATABASE_URL: "databaseUrl" in opts ? opts.databaseUrl : "postgres://x", ENVIRONMENT: "production" },
    req: { path: "/p", method: "GET" },
    var: { requestId: "r", auth: { userId: "u", role: "MANAGER" } },
    executionCtx: opts.executionCtx,
  } as unknown as Context<ApiEnv>;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.clearAllMocks());

describe("waitUntilSafe", () => {
  it("delegates to executionCtx.waitUntil in the Workers runtime", async () => {
    const waitUntil = vi.fn();
    waitUntilSafe(ctx({ executionCtx: { waitUntil } }), Promise.resolve());
    expect(waitUntil).toHaveBeenCalledOnce();
    await flush();
    expect(captureError).not.toHaveBeenCalled();
  });

  it("runs detached (no executionCtx) and reports a rejection to the error monitor", async () => {
    waitUntilSafe(ctx(), Promise.reject(new Error("bg boom")));
    await flush();
    expect(captureError).toHaveBeenCalledOnce();
    expect(captureError.mock.calls[0][1]).toMatchObject({ source: "api", message: "bg boom", statusCode: null });
  });

  it("skips the monitor write when DATABASE_URL is unset", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    waitUntilSafe(ctx({ databaseUrl: undefined }), Promise.reject(new Error("x")));
    await flush();
    expect(captureError).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("swallows a monitor write that throws synchronously", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    captureError.mockImplementationOnce(() => {
      throw new Error("sync boom");
    });
    expect(() => waitUntilSafe(ctx(), Promise.reject(new Error("x")))).not.toThrow();
    await flush();
  });

  it("swallows a monitor write that rejects asynchronously", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    captureError.mockRejectedValueOnce(new Error("monitor db down"));
    waitUntilSafe(ctx(), Promise.reject(new Error("x")));
    await flush();
    expect(captureError).toHaveBeenCalledOnce();
  });

  it("coerces a non-Error rejection into an Error for the monitor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    waitUntilSafe(ctx(), Promise.reject("stringy"));
    await flush();
    expect(captureError).toHaveBeenCalledOnce();
    expect(captureError.mock.calls[0][1]).toMatchObject({ message: "stringy" });
  });
});
