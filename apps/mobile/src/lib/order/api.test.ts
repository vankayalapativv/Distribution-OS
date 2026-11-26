import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCredit, fetchOils, submitOrder } from "./api";

const apiFetch = vi.fn();
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

afterEach(() => apiFetch.mockReset());

describe("fetchOils", () => {
  it("unwraps the products array and passes the token", async () => {
    const products = [{ id: "p1", productName: "Oil", brand: null, unit: "litres", segments: [], packSizes: [] }];
    apiFetch.mockResolvedValue({ products });
    await expect(fetchOils("tok")).resolves.toBe(products);
    expect(apiFetch).toHaveBeenCalledWith("/orders/products", { token: "tok" });
  });
});

describe("fetchCredit", () => {
  it("maps the credit status fields", async () => {
    apiFetch.mockResolvedValue({ creditBlocked: true, creditOverdueDays: 45, totalOutstanding: 1200, extra: "x" });
    await expect(fetchCredit("c1", "tok")).resolves.toEqual({
      creditBlocked: true,
      creditOverdueDays: 45,
      totalOutstanding: 1200,
    });
    expect(apiFetch).toHaveBeenCalledWith("/customers/c1/invoices", { token: "tok" });
  });
  it("returns null on error (never blocks the order)", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    await expect(fetchCredit("c1", null)).resolves.toBeNull();
  });
});

describe("submitOrder", () => {
  it("POSTs the order and unwraps the result", async () => {
    apiFetch.mockResolvedValue({ order: { orderCode: "ORD-1", existing: true } });
    const input = { customerId: "c1", orderDate: "2026-08-05", items: [], clientUuid: "uuid-1" };
    await expect(submitOrder("tok", input)).resolves.toEqual({ orderCode: "ORD-1", existing: true });
    expect(apiFetch).toHaveBeenCalledWith("/orders", { method: "POST", token: "tok", body: input });
  });
});
