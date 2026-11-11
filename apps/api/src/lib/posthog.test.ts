import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePostHogException } from "./posthog";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

function ctx(env: Record<string, unknown>): Context<ApiEnv> {
  return {
    env,
    req: { path: "/api/v1/orders", method: "POST" },
  } as unknown as Context<ApiEnv>;
}
const extra = { statusCode: 500, apiCode: "BOOM", requestId: "r1", userId: "u1", role: "MANAGER" };

afterEach(() => vi.restoreAllMocks());

describe("capturePostHogException", () => {
  it("is a silent no-op in production when the token is missing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await capturePostHogException(new Error("x"), ctx({ ENVIRONMENT: "production" }), extra);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("logs loudly in non-production when the token is missing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await capturePostHogException(new Error("x"), ctx({ ENVIRONMENT: "development" }), extra);
    expect(errSpy).toHaveBeenCalledOnce();
  });

  it("POSTs an $exception to the capture endpoint when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await capturePostHogException(new Error("kaboom"), ctx({ POSTHOG_PROJECT_TOKEN: "phc_x", POSTHOG_HOST: "https://eu.i.posthog.com/" }), extra);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/i/v0/e/"); // trailing slash stripped
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ api_key: "phc_x", event: "$exception", distinct_id: "u1" });
    expect(body.properties.$exception_message).toBe("kaboom");
  });

  it("defaults the host and anonymous distinct_id, and tolerates a message-less error", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const err = new Error();
    err.name = "";
    await capturePostHogException(err, ctx({ POSTHOG_PROJECT_TOKEN: "t" }), { ...extra, userId: null });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/i/v0/e/");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.distinct_id).toBe("api:anonymous");
    expect(body.properties.$exception_type).toBe("Error");
  });

  it("swallows a fetch rejection (never throws)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(
      capturePostHogException(new Error("x"), ctx({ POSTHOG_PROJECT_TOKEN: "t" }), extra),
    ).resolves.toBeUndefined();
  });
});
