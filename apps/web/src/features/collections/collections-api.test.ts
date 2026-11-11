import { afterEach, describe, expect, it } from "vitest";
import { getActionConfig } from "./collections-api";

const original = process.env.DISTRIBUTION_OS_API_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.DISTRIBUTION_OS_API_BASE_URL;
  else process.env.DISTRIBUTION_OS_API_BASE_URL = original;
});

describe("getActionConfig", () => {
  it("uses DISTRIBUTION_OS_API_BASE_URL when set", () => {
    process.env.DISTRIBUTION_OS_API_BASE_URL = "https://api.example/v1";
    expect(getActionConfig()).toEqual({ apiBaseUrl: "https://api.example/v1" });
  });

  it("falls back to the local worker URL", () => {
    delete process.env.DISTRIBUTION_OS_API_BASE_URL;
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
