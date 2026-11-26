import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAvailableStock, packLabel } from "./stock";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ godowns: [], products: [] }));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
afterEach(() => vi.clearAllMocks());

describe("fetchAvailableStock", () => {
  it("fetches all on-hand stock", async () => {
    const stock = { godowns: [{ id: "g1", name: "Main" }], products: [] };
    apiFetch.mockResolvedValue(stock);
    expect(await fetchAvailableStock("tok")).toBe(stock);
    expect(apiFetch).toHaveBeenCalledWith("/stock/available", { token: "tok" });
  });
});

describe("packLabel", () => {
  it("renders 'pcs' for piece-sold products", () => {
    expect(packLabel(1, "quantity")).toBe("pcs");
  });
  it("renders whole-litre and fractional-litre packs", () => {
    expect(packLabel(5, "litres")).toBe("5 L");
    expect(packLabel(2.5, "litres")).toBe("2.5 L");
  });
});
