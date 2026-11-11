import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => Promise.resolve({}) }));
const serverApiFetch = vi.fn();
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));

import { getActionConfig, listTrackedExecutives } from "./tracking-api";

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

describe("listTrackedExecutives", () => {
  it("returns the executives + date from a successful response", async () => {
    serverApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { executives: [{ userId: "u1" }], date: "2026-09-14" } }),
    });
    expect(await listTrackedExecutives()).toEqual({ executives: [{ userId: "u1" }], date: "2026-09-14" });
    expect(serverApiFetch).toHaveBeenCalledWith("/tracking/executives", expect.objectContaining({ cache: "no-store" }));
  });

  it("throws when the API responds with an error status", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(listTrackedExecutives()).rejects.toThrow(/503/);
  });
});
