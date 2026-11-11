import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => Promise.resolve({}) }));
const serverApiFetch = vi.fn();
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));

import { getActionConfig, listAlerts } from "./alerts-api";

const original = process.env.DISTRIBUTION_OS_API_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.DISTRIBUTION_OS_API_BASE_URL;
  else process.env.DISTRIBUTION_OS_API_BASE_URL = original;
  serverApiFetch.mockReset();
});

describe("getActionConfig", () => {
  it("uses DISTRIBUTION_OS_API_BASE_URL when set, else the local worker", () => {
    process.env.DISTRIBUTION_OS_API_BASE_URL = "https://api.example/v1";
    expect(getActionConfig()).toEqual({ apiBaseUrl: "https://api.example/v1" });
    delete process.env.DISTRIBUTION_OS_API_BASE_URL;
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});

describe("listAlerts", () => {
  it("returns the alert list from a successful response", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [{ id: "a1" }] }) });
    expect(await listAlerts()).toEqual([{ id: "a1" }]);
    expect(serverApiFetch).toHaveBeenCalledWith("/alerts", expect.objectContaining({ cache: "no-store" }));
  });

  it("appends the status filter to the query", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
    await listAlerts({ status: "open" });
    expect(serverApiFetch).toHaveBeenCalledWith("/alerts?status=open", expect.anything());
  });

  it("throws on an error status", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(listAlerts()).rejects.toThrow(/500/);
  });
});
