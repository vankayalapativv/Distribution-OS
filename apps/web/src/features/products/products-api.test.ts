import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/server-session", () => ({ getApiAuthHeaders: () => Promise.resolve({}) }));
const serverApiFetch = vi.fn();
vi.mock("../../lib/server-api", () => ({ serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) }));

import { getProductsActionConfig, listManagedProducts } from "./products-api";

const ok = (data: unknown) => ({ ok: true, json: () => Promise.resolve({ success: true, data }) });
const original = process.env.SRI_APARAJITA_API_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.SRI_APARAJITA_API_BASE_URL;
  else process.env.SRI_APARAJITA_API_BASE_URL = original;
  serverApiFetch.mockReset();
});

describe("getProductsActionConfig", () => {
  it("uses the env URL or the local fallback", () => {
    process.env.SRI_APARAJITA_API_BASE_URL = "https://api.example/v1";
    expect(getProductsActionConfig().apiBaseUrl).toBe("https://api.example/v1");
    delete process.env.SRI_APARAJITA_API_BASE_URL;
    expect(getProductsActionConfig().apiBaseUrl).toBe("http://localhost:8787/api/v1");
  });
});

describe("list fetchers", () => {
  it("unwrap the products payload", async () => {
    serverApiFetch.mockResolvedValueOnce(ok({ products: [{ id: "p1" }] }));
    expect(await listManagedProducts()).toEqual([{ id: "p1" }]);
  });

  it("throw on error statuses", async () => {
    serverApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(listManagedProducts()).rejects.toThrow(/500/);
  });
});
