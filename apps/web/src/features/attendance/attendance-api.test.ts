import { afterEach, describe, expect, it } from "vitest";
import { getActionConfig } from "./attendance-api";

describe("getActionConfig", () => {
  const original = process.env.SRI_APARAJITA_API_BASE_URL;
  afterEach(() => { process.env.SRI_APARAJITA_API_BASE_URL = original; });

  it("uses the configured API base URL", () => {
    process.env.SRI_APARAJITA_API_BASE_URL = "https://api.example.test/v1";
    expect(getActionConfig()).toEqual({ apiBaseUrl: "https://api.example.test/v1" });
  });

  it("falls back to the local worker when unset", () => {
    delete process.env.SRI_APARAJITA_API_BASE_URL;
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
