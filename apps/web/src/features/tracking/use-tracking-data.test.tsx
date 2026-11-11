import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stateful URL mock: push/replace update the params + re-render subscribers.
let sp = new URLSearchParams();
const listeners = new Set<() => void>();
const setUrl = (u: string) => {
  sp = new URLSearchParams(u.includes("?") ? u.slice(u.indexOf("?") + 1) : "");
  listeners.forEach((l) => l());
};
vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      listeners.add(force);
      return () => { listeners.delete(force); };
    }, []);
    return sp;
  },
  useRouter: () => ({ push: setUrl, replace: setUrl }),
  usePathname: () => "/tracking",
}));

const h = vi.hoisted(() => ({
  refetchExec: vi.fn(), refetchRoute: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calls: [] as any[], results: {} as Record<string, any>,
}));
vi.mock("@tanstack/react-query", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useQuery: (cfg: any) => { h.calls.push(cfg); return h.results[cfg.queryKey[0]] ?? {}; },
}));
vi.mock("./use-tracking-overlays", () => ({
  useTrackingOverlays: () => ({ customers: [], customerDistricts: ["Nalgonda"], deviceHealth: [] }),
}));
const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { useTrackingData } from "./use-tracking-data";
import type { TrackedExecutive } from "./tracking-api";

const config = { apiBaseUrl: "", authToken: "" };
const execs = [{ userId: "e1" }, { userId: "e2" }] as TrackedExecutive[];

beforeEach(() => {
  sp = new URLSearchParams();
  h.calls.length = 0;
  h.results = {
    "tracking-executives": { data: { executives: execs }, dataUpdatedAt: 1_700_000_000_000, error: null, refetch: h.refetchExec, isPlaceholderData: false },
    "tracking-route": { data: { points: [{ lat: 1, lng: 2 }] }, error: null, refetch: h.refetchRoute, isPlaceholderData: true },
    "tracking-checkins": { data: { checkins: [{ id: "c1" }] } },
  };
});

const setup = (initialExecutives = execs, initialDate = "2026-09-14") =>
  renderHook(() => useTrackingData({ initialExecutives, initialDate, actionConfig: config }));

describe("useTrackingData", () => {
  it("defaults selection to the first executive and derives route/checkins/lastUpdated", () => {
    const { result } = setup();
    expect(result.current.effectiveSelectedUserId).toBe("e1");
    expect(result.current.routePoints).toEqual([{ lat: 1, lng: 2 }]);
    expect(result.current.routeStale).toBe(true);
    expect(result.current.checkins).toEqual([{ id: "c1" }]);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(result.current.customerDistricts).toEqual(["Nalgonda"]);
  });

  it("polls every 60s for today", () => {
    setup();
    expect(h.calls[0].refetchInterval).toBe(60_000);
  });

  it("stops polling once a past date is selected", () => {
    const { result } = setup(execs, "2026-09-14");
    h.calls.length = 0;
    act(() => result.current.setDate("2020-01-01")); // no longer "today"
    const execCall = h.calls.find((c) => c.queryKey[0] === "tracking-executives");
    expect(execCall.refetchInterval).toBe(false);
  });

  it("falls back to the first executive when the selection is gone", () => {
    const { result } = setup();
    act(() => result.current.setSelectedUserId("ghost"));
    expect(result.current.effectiveSelectedUserId).toBe("e1");
  });

  it("has no selection when there are no executives", () => {
    h.results["tracking-executives"] = { data: { executives: [] }, error: null, isPlaceholderData: false, refetch: h.refetchExec };
    const { result } = setup([]);
    expect(result.current.effectiveSelectedUserId).toBeNull();
  });

  it("surfaces the executives error, then the route error", () => {
    h.results["tracking-executives"].error = new Error("exec down");
    const { result } = setup();
    expect(result.current.displayError).toBe("exec down");
    h.results["tracking-executives"].error = null;
    h.results["tracking-route"].error = new Error("route down");
    const { result: r2 } = setup();
    expect(r2.current.displayError).toBe("route down");
  });

  it("refetches executives and route together", () => {
    const { result } = setup();
    act(() => result.current.refetch());
    expect(h.refetchExec).toHaveBeenCalled();
    expect(h.refetchRoute).toHaveBeenCalled();
  });

  it("wires each query's fetcher and keeps previous data as the placeholder", () => {
    setup();
    for (const c of h.calls) {
      if (c.queryFn) c.queryFn(); // executes the apiGet fetcher arrow
      if (c.placeholderData) expect(c.placeholderData("prev")).toBe("prev");
    }
    expect(apiGet).toHaveBeenCalled();
  });
});
