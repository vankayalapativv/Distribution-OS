import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getStates = vi.fn();
const loadDistricts = vi.fn();
vi.mock("vardhan-maps/data", () => ({
  getStates: () => getStates(),
  loadDistricts: (name: string) => loadDistricts(name),
}));

import { useAllStates, useStateDistricts } from "./use-map-geodata";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => vi.clearAllMocks());

describe("useAllStates", () => {
  it("returns the bundled state features once (memoised)", () => {
    const states = [{ type: "Feature", properties: { name: "Telangana" } }];
    getStates.mockReturnValue(states);
    const { result, rerender } = renderHook(() => useAllStates());
    expect(result.current).toBe(states);
    rerender();
    expect(getStates).toHaveBeenCalledTimes(1); // memoised across renders
  });
});

describe("useStateDistricts", () => {
  it("returns an empty array (no fetch) until a state is selected", () => {
    const { result } = renderHook(() => useStateDistricts(null), { wrapper });
    expect(result.current).toEqual([]);
    expect(loadDistricts).not.toHaveBeenCalled();
  });

  it("lazily loads the selected state's districts", async () => {
    const districts = [{ type: "Feature", properties: { name: "Hyderabad" } }];
    loadDistricts.mockResolvedValue(districts);
    const { result } = renderHook(() => useStateDistricts("Telangana"), { wrapper });
    await waitFor(() => expect(result.current).toEqual(districts));
    expect(loadDistricts).toHaveBeenCalledWith("Telangana");
  });
});
