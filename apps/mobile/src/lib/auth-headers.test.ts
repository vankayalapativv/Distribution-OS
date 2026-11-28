import { describe, expect, it } from "vitest";
import { authHeaders } from "./auth-headers";

describe("authHeaders", () => {
  it("returns a Bearer header when a token is present", () => {
    expect(authHeaders("tok")).toEqual({ Authorization: "Bearer tok" });
  });

  it("returns undefined without a token", () => {
    expect(authHeaders(null)).toBeUndefined();
  });
});
