import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ id: "u1", name: "A", email: null, phone: null, status: "inactive" }),
}));

import { apiRequest } from "@/lib/api-client";
import { saveSuperAdminUser } from "./super-admin-save-user";
import type { SuperAdminSetupUser } from "./super-admin-types";

const cfg = { apiBaseUrl: "https://api.test/api/v1", authToken: "jwt" };
const payload = { name: "A", email: null, phone: null, status: "inactive" };
const user = (over: Partial<SuperAdminSetupUser> = {}): SuperAdminSetupUser => ({
  id: "u1", name: "A", email: null, phone: null, status: "active", appLoginId: null, roles: ["MANAGER"], ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("saveSuperAdminUser", () => {
  it("routes a Neon-Auth-linked user through the BFF (not the API)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", status: "inactive" }), { status: 200 }),
    );
    await saveSuperAdminUser(user({ appLoginId: "neon-1" }), payload, cfg);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/update-user", expect.objectContaining({ method: "POST" }));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("routes a local user straight to the API PATCH", async () => {
    await saveSuperAdminUser(user(), payload, cfg);
    expect(apiRequest).toHaveBeenCalledWith(
      cfg,
      "PATCH",
      "/super-admin/users/u1",
      expect.objectContaining(payload),
    );
  });

  it("surfaces a BFF error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Neon said no" }), { status: 400 }),
    );
    await expect(saveSuperAdminUser(user({ appLoginId: "neon-1" }), payload, cfg)).rejects.toThrow("Neon said no");
  });
});
