import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverApiFetch = vi.fn();
const getApiAuthHeaders = vi.fn(async () => ({ Authorization: "Bearer t" }));

vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));
vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => getApiAuthHeaders() }));

import {
  fetchMyName,
  getDashboardExperienceData,
  getInitialDashboardMetrics,
  getMetricsApiBaseUrl,
} from "./dashboard-api";

const res = (ok: boolean, body: unknown, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

afterEach(() => {
  serverApiFetch.mockReset();
  getApiAuthHeaders.mockClear();
});

describe("getDashboardExperienceData", () => {
  it("fetches the role dashboard and maps the body", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: { metrics: { salesValue: 10 } } }));
    const data = await getDashboardExperienceData("SUPER_ADMIN");
    expect(serverApiFetch).toHaveBeenCalledWith("/dashboard/super-admin", expect.objectContaining({ cache: "no-store" }));
    expect(data.metrics).toEqual([{ label: "Sales Value", value: "10" }]);
  });

  it("throws when the response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}, 503));
    await expect(getDashboardExperienceData("MANAGER")).rejects.toThrow("503");
  });

  it("throws when the body is not successful", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: false, data: {} }));
    await expect(getDashboardExperienceData("ACCOUNTANT")).rejects.toThrow("unsuccessful");
  });
});

describe("fetchMyName", () => {
  it("returns the trimmed name on success", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: { name: "  Murali  " } }));
    expect(await fetchMyName()).toBe("Murali");
  });

  it("returns empty string when name is missing", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: {} }));
    expect(await fetchMyName()).toBe("");
  });

  it("returns empty string when the response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}));
    expect(await fetchMyName()).toBe("");
  });

  it("returns empty string when the body is not successful", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: false, data: {} }));
    expect(await fetchMyName()).toBe("");
  });

  it("swallows errors and returns empty string", async () => {
    serverApiFetch.mockRejectedValue(new Error("network"));
    expect(await fetchMyName()).toBe("");
  });
});

describe("getInitialDashboardMetrics", () => {
  it("returns the metrics data on success", async () => {
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: { visits: 14 } }));
    expect(await getInitialDashboardMetrics()).toEqual({ visits: 14 });
  });

  it("throws when the metrics response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}, 500));
    await expect(getInitialDashboardMetrics()).rejects.toThrow("500");
  });
});

describe("getMetricsApiBaseUrl", () => {
  const original = process.env.SRI_APARAJITA_API_BASE_URL;
  beforeEach(() => { delete process.env.SRI_APARAJITA_API_BASE_URL; });
  afterEach(() => { process.env.SRI_APARAJITA_API_BASE_URL = original; });

  it("uses the env var when set", () => {
    process.env.SRI_APARAJITA_API_BASE_URL = "https://api.example/v1";
    expect(getMetricsApiBaseUrl()).toBe("https://api.example/v1");
  });

  it("falls back to the localhost dev URL", () => {
    expect(getMetricsApiBaseUrl()).toBe("http://localhost:8787/api/v1");
  });
});
