import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMySalary } from "./salary";

const apiFetch = vi.fn();
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
afterEach(() => vi.clearAllMocks());

describe("fetchMySalary", () => {
  it("GETs /salary/mine with the token", async () => {
    apiFetch.mockResolvedValue({ monthlySalary: 20000, advanceOutstanding: 0, thisMonth: null });
    const out = await fetchMySalary("tok");
    expect(apiFetch).toHaveBeenCalledWith("/salary/mine", { token: "tok" });
    expect(out.monthlySalary).toBe(20000);
  });
});
