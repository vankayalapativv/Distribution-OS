import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => Promise.resolve({}) }));
const serverApiFetch = vi.fn();
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));

import { getActionConfig, listCustomersLite, listTaskAssignees, listTasks } from "./tasks-api";

const ok = (data: unknown) => ({ ok: true, json: () => Promise.resolve({ success: true, data }) });
const original = process.env.DISTRIBUTION_OS_API_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.DISTRIBUTION_OS_API_BASE_URL;
  else process.env.DISTRIBUTION_OS_API_BASE_URL = original;
  serverApiFetch.mockReset();
});

describe("getActionConfig", () => {
  it("uses the env URL or the local fallback", () => {
    process.env.DISTRIBUTION_OS_API_BASE_URL = "https://api.example/v1";
    expect(getActionConfig().apiBaseUrl).toBe("https://api.example/v1");
    delete process.env.DISTRIBUTION_OS_API_BASE_URL;
    expect(getActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});

describe("list fetchers", () => {
  it("listTasks / listTaskAssignees unwrap their payloads", async () => {
    serverApiFetch.mockResolvedValueOnce(ok({ tasks: [{ id: "t1" }] }));
    expect(await listTasks()).toEqual([{ id: "t1" }]);
    serverApiFetch.mockResolvedValueOnce(ok({ assignees: [{ id: "u1", name: "Ravi", role: "MANAGER" }] }));
    expect(await listTaskAssignees()).toEqual([{ id: "u1", name: "Ravi", role: "MANAGER" }]);
  });

  it("listCustomersLite maps addressCity → city with a null fallback", async () => {
    serverApiFetch.mockResolvedValueOnce(ok([
      { id: "c1", legalName: "Sri Laxmi", customerCode: "CUST-1", addressCity: "Nalgonda", salesExecutiveName: "Ravi" },
      { id: "c2", legalName: "Balaji", customerCode: "CUST-2", addressCity: null, salesExecutiveName: null },
    ]));
    const rows = await listCustomersLite();
    expect(rows[0]).toEqual({ id: "c1", legalName: "Sri Laxmi", customerCode: "CUST-1", city: "Nalgonda", salesExecutiveName: "Ravi" });
    expect(rows[1].city).toBeNull();
  });

  it("throws on an error status", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(listTasks()).rejects.toThrow(/500/);
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(listTaskAssignees()).rejects.toThrow(/503/);
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(listCustomersLite()).rejects.toThrow(/404/);
  });
});
