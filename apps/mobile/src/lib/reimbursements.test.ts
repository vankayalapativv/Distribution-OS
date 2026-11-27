import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMyReimbursements } from "./reimbursements";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
afterEach(() => vi.clearAllMocks());

describe("fetchMyReimbursements", () => {
  it("GETs /reimbursements/mine with the token", async () => {
    apiFetch.mockResolvedValue({ owedTotal: 450, payables: [] });
    const out = await fetchMyReimbursements("tok");
    expect(apiFetch).toHaveBeenCalledWith("/reimbursements/mine", { token: "tok" });
    expect(out.owedTotal).toBe(450);
  });
});
