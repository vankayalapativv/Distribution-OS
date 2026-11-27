import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMyAdvances, requestAdvanceApi } from "./advances";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
afterEach(() => vi.clearAllMocks());

describe("advances api", () => {
  it("fetches my advances with the token", async () => {
    apiFetch.mockResolvedValue({ outstandingTotal: 8000, advances: [] });
    const out = await fetchMyAdvances("tok");
    expect(apiFetch).toHaveBeenCalledWith("/advances/mine", { token: "tok" });
    expect(out.outstandingTotal).toBe(8000);
  });

  it("POSTs an advance request", async () => {
    apiFetch.mockResolvedValue({ id: "a1" });
    await requestAdvanceApi("tok", 10000, "medical");
    expect(apiFetch).toHaveBeenCalledWith("/advances", { method: "POST", token: "tok", body: { amount: 10000, reason: "medical" } });
  });
});
