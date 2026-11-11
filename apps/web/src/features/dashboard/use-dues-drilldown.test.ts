import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mutable URL mock: router writes update `search`; the hook re-derives.
const nav = vi.hoisted(() => {
  const state = { search: "" };
  const apply = (url: string) => {
    state.search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  };
  return { state, push: vi.fn(apply), replace: vi.fn(apply) };
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.state.search),
  usePathname: () => "/",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}));

import { useDuesDrilldown } from "./use-dues-drilldown";
import type { DuesBucket } from "./dues-helpers";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const bucket: DuesBucket = { key: "30_45", label: "31–45d", customers: 3, outstanding: 1000 };

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}
const render = (filters?: { executiveId: string; city: string }) =>
  renderHook(() => useDuesDrilldown(cfg, filters, [bucket]), { wrapper });

beforeEach(() => {
  nav.state.search = "";
  nav.push.mockClear();
  nav.replace.mockClear();
  apiGet.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("useDuesDrilldown", () => {
  it("open pushes ?bucket; close replaces it away", () => {
    const { result } = render();
    act(() => result.current.open(bucket));
    expect(nav.push).toHaveBeenCalledWith("/?bucket=30_45", { scroll: false });
    nav.state.search = "bucket=30_45";
    act(() => result.current.close());
    expect(nav.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("loads the bucket's customers scoped to the active filter", async () => {
    apiGet.mockResolvedValue({ customers: [{ customerId: "c1" }] });
    nav.state.search = "bucket=30_45";
    const { result } = render({ executiveId: "e1", city: "Guntur" });
    await waitFor(() => expect(result.current.rows).toEqual([{ customerId: "c1" }]));
    const url = apiGet.mock.calls[0][1] as string;
    expect(url).toContain("bucket=30_45");
    expect(url).toContain("executiveId=e1");
    expect(url).toContain("city=Guntur");
    expect(result.current.bucket).toEqual(bucket);
  });

  it("omits empty filters and surfaces errors", async () => {
    apiGet.mockRejectedValue(new Error("nope"));
    nav.state.search = "bucket=30_45";
    const { result } = render();
    await waitFor(() => expect(result.current.error).toBe("nope"));
    const url = apiGet.mock.calls[0][1] as string;
    expect(url).not.toContain("executiveId");
    expect(url).not.toContain("city");
  });

  it("is closed (no fetch) when no bucket is in the URL", () => {
    const { result } = render();
    expect(result.current.bucket).toBeNull();
    expect(result.current.rows).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });
});
