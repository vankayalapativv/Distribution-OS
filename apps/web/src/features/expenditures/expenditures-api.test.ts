import { afterEach, describe, expect, it } from "vitest";
import { getActionConfig, paymentModeLabel } from "./expenditures-api";

describe("paymentModeLabel", () => {
  it("maps a known mode to its label, passes through unknowns, dashes null", () => {
    expect(paymentModeLabel("upi")).toBe("UPI");
    expect(paymentModeLabel("bank_transfer")).toBe("Bank Transfer");
    expect(paymentModeLabel("bitcoin")).toBe("bitcoin");
    expect(paymentModeLabel(null)).toBe("—");
  });
});

describe("getActionConfig", () => {
  const original = process.env.DISTRIBUTION_OS_API_BASE_URL;
  afterEach(() => { process.env.DISTRIBUTION_OS_API_BASE_URL = original; });
  it("uses the configured base url, else the local worker", () => {
    process.env.DISTRIBUTION_OS_API_BASE_URL = "https://api.test/v1";
    expect(getActionConfig()).toEqual({ apiBaseUrl: "https://api.test/v1" });
    delete process.env.DISTRIBUTION_OS_API_BASE_URL;
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
