import { afterEach, describe, expect, it } from "vitest";
import { getAuditActionConfig } from "./audit-logs-api";

describe("getAuditActionConfig", () => {
  const original = process.env.SRI_APARAJITA_API_BASE_URL;
  afterEach(() => { process.env.SRI_APARAJITA_API_BASE_URL = original; });

  it("uses the configured API base URL", () => {
    process.env.SRI_APARAJITA_API_BASE_URL = "https://api.example.test/v1";
    expect(getAuditActionConfig()).toEqual({ apiBaseUrl: "https://api.example.test/v1" });
  });

  it("falls back to the local worker when unset", () => {
    delete process.env.SRI_APARAJITA_API_BASE_URL;
    expect(getAuditActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
