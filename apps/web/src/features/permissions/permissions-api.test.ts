import { afterEach, describe, expect, it, vi } from "vitest";

const serverApiFetch = vi.fn();
const getApiAuthHeaders = vi.fn(async () => ({ Authorization: "Bearer t" }));
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));
vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => getApiAuthHeaders() }));

import { getActionConfig, getPermissionMatrix } from "./permissions-api";

const res = (ok: boolean, body: unknown, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

afterEach(() => {
  serverApiFetch.mockReset();
  vi.unstubAllEnvs();
});

describe("getPermissionMatrix", () => {
  it("fetches the matrix with auth headers", async () => {
    const matrix = { catalog: [], roles: { MANAGER: {}, ACCOUNTANT: {} } };
    serverApiFetch.mockResolvedValue(res(true, { success: true, data: matrix }));
    expect(await getPermissionMatrix()).toEqual(matrix);
    expect(serverApiFetch.mock.calls[0][0]).toBe("/permissions");
  });

  it("throws when the response is not ok", async () => {
    serverApiFetch.mockResolvedValue(res(false, {}, 403));
    await expect(getPermissionMatrix()).rejects.toThrow("403");
  });
});

describe("getActionConfig", () => {
  it("uses the configured API base URL", () => {
    vi.stubEnv("DISTRIBUTION_OS_API_BASE_URL", "http://api.test/api/v1");
    expect(getActionConfig()).toEqual({ apiBaseUrl: "http://api.test/api/v1" });
  });

  it("falls back to localhost when unset", () => {
    vi.stubEnv("DISTRIBUTION_OS_API_BASE_URL", undefined);
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});
