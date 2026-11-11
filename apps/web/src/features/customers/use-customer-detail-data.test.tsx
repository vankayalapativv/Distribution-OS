import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { useCustomerDetailData } from "./use-customer-detail-data";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

describe("useCustomerDetailData", () => {
  it("fetches photos, orders and the visit count, exposing derived data", async () => {
    apiGet.mockImplementation(async (..._a: unknown[]) => {
      const url = _a[1] as string;
      if (url.includes("/photos")) return { photos: [{ id: "p1" }] };
      if (url.includes("/orders/paged")) return { orders: [{ id: "o1" }], total: 4 };
      return { summary: { all: 9 } };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCustomerDetailData("c1", cfg), { wrapper: wrap(qc) });

    await waitFor(() => expect(result.current.photos).toHaveLength(1));
    expect(result.current.ordersTotal).toBe(4);
    expect(result.current.orders).toHaveLength(1);
    await waitFor(() => expect(result.current.visitsCount).toBe(9));
  });

  it("defaults to empty data before the queries resolve", () => {
    apiGet.mockImplementation(() => new Promise(() => {}));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCustomerDetailData("c1", cfg), { wrapper: wrap(qc) });
    expect(result.current.photos).toEqual([]);
    expect(result.current.ordersTotal).toBe(0);
    expect(result.current.visitsCount).toBe(0);
    expect(result.current.photosLoading).toBe(true);
  });
});
