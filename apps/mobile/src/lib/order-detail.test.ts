import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrderDetail } from "./order-detail";

const apiFetch = vi.fn();
let token: string | null = "tok";
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));

afterEach(() => {
  apiFetch.mockReset();
  token = "tok";
});

describe("fetchOrderDetail", () => {
  it("fetches and maps the order (using the current auth token)", async () => {
    apiFetch.mockResolvedValue({
      order: {
        orderCode: "ORD-9",
        orderDate: "2026-08-05T00:00:00Z",
        orderStatus: "placed",
        totalLitres: "25",
        items: [],
      },
    });
    const out = await fetchOrderDetail("ord-9");
    expect(out).toMatchObject({ orderCode: "ORD-9", orderDate: "2026-08-05", totalLitres: 25 });
    expect(apiFetch).toHaveBeenCalledWith("/orders/ord-9", { token: "tok" });
  });

  it("returns null when the fetch fails", async () => {
    apiFetch.mockRejectedValue(new Error("500"));
    await expect(fetchOrderDetail("ord-9")).resolves.toBeNull();
  });
});
