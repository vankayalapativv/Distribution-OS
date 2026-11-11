import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (...args: unknown[]) => {
  const url = args[1] as string;
  return url.includes("filter-options")
    ? { cities: ["Guntur"], salesExecutives: [{ id: "e1", name: "Ravi" }] }
    : { buckets: [], totalOutstanding: 0, totalCustomers: 0 };
});
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { useDuesData } from "./use-dues-data";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

describe("useDuesData", () => {
  it("defaults to empty lists, then loads options; builds unfiltered URLs", async () => {
    const { result } = renderHook(() => useDuesData(cfg, "", ""), { wrapper });
    expect(result.current.cities).toEqual([]); // before data resolves
    expect(result.current.salesExecutives).toEqual([]);
    await waitFor(() => expect(result.current.cities).toEqual(["Guntur"]));
    const urls = apiGet.mock.calls.map((c) => c[1] as string);
    expect(urls).toContain("/customers/filter-options");
    expect(urls).toContain("/dues/summary");
  });

  it("scopes both queries to the executive and city filter", async () => {
    apiGet.mockClear();
    renderHook(() => useDuesData(cfg, "e1", "Guntur"), { wrapper });
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    const urls = apiGet.mock.calls.map((c) => c[1] as string);
    expect(urls).toContain("/customers/filter-options?executiveId=e1");
    expect(urls.some((u) => u.includes("/dues/summary?executiveId=e1&city=Guntur"))).toBe(true);
  });
});
