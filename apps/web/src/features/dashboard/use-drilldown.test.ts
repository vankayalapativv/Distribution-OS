import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb),
}));

// Controllable URL mock.
let sp = new URLSearchParams();
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push, replace }),
  usePathname: () => "/",
}));

import { useDrilldown } from "./use-drilldown";
import type { AgentRow, MetricsActionConfig } from "./metrics-helpers";

const cfg = { apiBaseUrl: "x", authToken: "t" } as unknown as MetricsActionConfig;
const range = { from: "2026-09-01", to: "2026-09-15" };
const agent: AgentRow = { agentId: "a1", agentName: "Ravi" };

let qc: QueryClient;
beforeEach(() => {
  sp = new URLSearchParams();
  replace.mockClear();
  push.mockClear();
  apiGet.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: qc }, children);

describe("useDrilldown (URL-driven)", () => {
  it("derives the metric from ?metric= and fetches its agents", async () => {
    sp = new URLSearchParams("metric=visits");
    apiGet.mockResolvedValue({ agents: [agent] });
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    expect(result.current.metric).toBe("visits");
    await waitFor(() => expect(result.current.agents).toEqual([agent]));
    expect(apiGet.mock.calls[0][1]).toBe("/dashboard/metrics/visits/agents?from=2026-09-01&to=2026-09-15");
  });

  it("ignores an invalid metric param (no dialog, no fetch)", () => {
    sp = new URLSearchParams("metric=bogus");
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    expect(result.current.metric).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("openMetric PUSHES ?metric= (a Back target)", () => {
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    act(() => result.current.openMetric("visits"));
    expect(push).toHaveBeenCalledWith("/?metric=visits", { scroll: false });
    expect(replace).not.toHaveBeenCalled();
  });

  it("openAgent PUSHES ?agent= on top of the metric", () => {
    sp = new URLSearchParams("metric=visits");
    apiGet.mockResolvedValue({ agents: [agent] });
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    act(() => result.current.openAgent(agent));
    expect(push).toHaveBeenCalledWith("/?metric=visits&agent=a1", { scroll: false });
  });

  it("resolves the agent object from the loaded agents and fetches its customers", async () => {
    sp = new URLSearchParams("metric=visits&agent=a1");
    apiGet.mockImplementation((_c: unknown, path: string) =>
      path.includes("/customers")
        ? Promise.resolve({ rows: [{ customerId: "c1" }] })
        : Promise.resolve({ agents: [agent] }),
    );
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    await waitFor(() => expect(result.current.agent).toEqual(agent));
    await waitFor(() => expect(result.current.customerRows).toEqual([{ customerId: "c1" }]));
  });

  it("back clears the agent (replace); close clears metric+agent (replace)", () => {
    sp = new URLSearchParams("metric=visits&agent=a1");
    apiGet.mockResolvedValue({ agents: [agent] });
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    act(() => result.current.back());
    expect(replace).toHaveBeenCalledWith("/?metric=visits", { scroll: false });
    act(() => result.current.close());
    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("surfaces a fetch error", async () => {
    sp = new URLSearchParams("metric=visits");
    apiGet.mockRejectedValue(new Error("bad"));
    const { result } = renderHook(() => useDrilldown(cfg, range), { wrapper });
    await waitFor(() => expect(result.current.error).toBe("bad"));
  });
});
