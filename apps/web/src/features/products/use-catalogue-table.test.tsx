import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as unknown[], paged: { table: {}, total: 5, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null } }));
vi.mock("@/components/data-table/use-paged-table", () => ({ usePagedTable: (cfg: unknown) => { h.calls.push(cfg); return h.paged; } }));

let sp = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/products",
}));

import { useCatalogueTable } from "./use-catalogue-table";

const config = { apiBaseUrl: "", authToken: "" };
const handlers = { onEditProduct: vi.fn(), onDeleteProduct: vi.fn() };
const setup = (category: "oils" = "oils") => {
  // The hook now uses React Query (brand options), so it needs a provider.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCatalogueTable(category, config, true, handlers), { wrapper });
};

beforeEach(() => { h.calls.length = 0; sp = new URLSearchParams(); replace.mockClear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useCatalogueTable", () => {
  it("wires the paged table to the oils endpoint + columns", () => {
    const { result } = setup("oils");
    const cfg = h.calls.at(-1) as { path: string; rowsKey: string; columns: unknown[] };
    expect(cfg.path).toBe("/products/paged");
    expect(cfg.rowsKey).toBe("products");
    expect(result.current.noun).toBe("oil");
    expect(result.current.columns).toHaveLength(result.current.skeleton.length);
  });

  it("debounces the search box and writes it to the URL", () => {
    const { result } = setup();
    act(() => result.current.setSearch("  5W30 "));
    act(() => vi.advanceTimersByTime(350));
    expect(replace).toHaveBeenCalledWith("/products?search=5W30", { scroll: false });
  });

});
