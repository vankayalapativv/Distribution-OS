import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => [{ id: "s1", legalName: "Server Co" }]);
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import {
  buildMeta,
  resolveEmptyText,
  useCustomerSearch,
  type CustomerOption,
} from "./use-customer-search";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const seed: CustomerOption[] = [{ id: "c1", legalName: "Seed Co", addressCity: "Hyd" }];
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

afterEach(() => apiGet.mockClear());

describe("buildMeta", () => {
  it("joins present fields and omits absent ones", () => {
    expect(buildMeta({ id: "x", legalName: "A", addressCity: "Hyd", salesExecutiveName: "Ravi" })).toBe("Hyd · Ravi");
    expect(buildMeta({ id: "x", legalName: "A", addressCity: null, salesExecutiveName: "Ravi" })).toBe("Ravi");
    expect(buildMeta({ id: "x", legalName: "A" })).toBe("");
  });
});

describe("resolveEmptyText", () => {
  it("prefers the fetching state, then a searched/seeded empty, then the prompt", () => {
    expect(resolveEmptyText(true, 3, 0, "none")).toBe("Searching…");
    expect(resolveEmptyText(false, 3, 0, "none")).toBe("none");
    expect(resolveEmptyText(false, 0, 2, "none")).toBe("none");
    expect(resolveEmptyText(false, 0, 0, "none")).toBe("Type a name, phone or city to search");
  });
});

describe("useCustomerSearch", () => {
  it("seeds the list and resolves the selected name from the seed map", () => {
    const qc = new QueryClient();
    const { result } = renderHook(
      () => useCustomerSearch({ actionConfig: cfg, valueKey: "c1", seedItems: seed }),
      { wrapper: wrap(qc) },
    );
    expect(result.current.list).toEqual(seed);
    expect(result.current.selectedName).toBe("Seed Co");
  });

  it("falls back to selectedLabel, and is blank with no valueKey", () => {
    const qc = new QueryClient();
    const { result } = renderHook(
      () => useCustomerSearch({ actionConfig: cfg, valueKey: "zzz", seedItems: seed, selectedLabel: "Old Co" }),
      { wrapper: wrap(qc) },
    );
    expect(result.current.selectedName).toBe("Old Co");

    const { result: blank } = renderHook(
      () => useCustomerSearch({ actionConfig: cfg, valueKey: "", seedItems: seed }),
      { wrapper: wrap(qc) },
    );
    expect(blank.current.selectedName).toBe("");
  });

  it("debounces into a server search and prefers a chosen label", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCustomerSearch({ actionConfig: cfg, valueKey: "s1", seedItems: seed }),
      { wrapper: wrap(qc) },
    );
    act(() => result.current.setOpen(true));
    act(() => result.current.setSearch("serv"));
    await waitFor(() => expect(result.current.list[0]?.id).toBe("s1"));
    expect(apiGet).toHaveBeenCalledWith(cfg, "/customers?search=serv");

    act(() => result.current.choose({ id: "s1", legalName: "Server Co" }));
    expect(result.current.selectedName).toBe("Server Co");

    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    expect(result.current.list).toEqual(seed);
  });
});
