import { describe, expect, it } from "vitest";
import { apiInfo, failure, placeholderResource, success } from "./api-response";
import type { Context } from "hono";
import type { ApiEnv } from "../types";

function ctx(env: Record<string, unknown> = {}): Context<ApiEnv> {
  return { var: { requestId: "req-1" }, env } as unknown as Context<ApiEnv>;
}

describe("success", () => {
  it("wraps data with the request id", () => {
    expect(success(ctx(), { a: 1 })).toEqual({ success: true, data: { a: 1 }, meta: { requestId: "req-1" } });
  });
});

describe("failure", () => {
  it("builds an error envelope without details", () => {
    expect(failure(ctx(), "CODE", "msg")).toEqual({
      success: false,
      error: { code: "CODE", message: "msg" },
      meta: { requestId: "req-1" },
    });
  });

  it("includes details when provided", () => {
    expect(failure(ctx(), "CODE", "msg", { field: "x" }).error).toMatchObject({ details: { field: "x" } });
  });
});

describe("apiInfo", () => {
  it("uses env values when set", () => {
    const res = apiInfo(ctx({ API_VERSION: "v2", ENVIRONMENT: "staging" }));
    expect(res.data).toMatchObject({ version: "v2", environment: "staging" });
    expect(res.data.routes).toHaveProperty("versionedBase", "/api/v1");
  });

  it("falls back to defaults when env is unset", () => {
    const res = apiInfo(ctx());
    expect(res.data).toMatchObject({ version: "v1", environment: "development" });
  });
});

describe("placeholderResource", () => {
  it("marks a resource not-yet-implemented and merges details", () => {
    const res = placeholderResource(ctx(), "Reports", { eta: "soon" });
    expect(res.data).toMatchObject({ resource: "Reports", implemented: false, eta: "soon" });
  });

  it("works with no extra details", () => {
    expect(placeholderResource(ctx(), "Reports").data).toMatchObject({ implemented: false });
  });
});
