import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer t" }) }));
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => fetchMock(...a) }));

import { getActionConfig, listReassignCustomers } from "./reassign-api";

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe("listReassignCustomers", () => {
  it("returns the data array and calls the reassign list endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [{ id: "c1", legalName: "A", customerCode: null, city: null, owner: null, recordCount: 0 }] }),
    });
    const rows = await listReassignCustomers();
    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/customers/reassign/customers", expect.objectContaining({ cache: "no-store" }));
  });

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(listReassignCustomers()).rejects.toThrow(/500/);
  });
});

describe("getActionConfig", () => {
  it("uses the env base url when set", () => {
    vi.stubEnv("DISTRIBUTION_OS_API_BASE_URL", "https://api.example/api/v1");
    expect(getActionConfig().apiBaseUrl).toBe("https://api.example/api/v1");
  });

  it("falls back to the localhost default when unset", () => {
    vi.stubEnv("DISTRIBUTION_OS_API_BASE_URL", undefined as unknown as string);
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
