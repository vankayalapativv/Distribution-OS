import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { TargetsResponse } from "./targets-api";

const apiGet = vi.fn();
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});

import { useTargetsPanel } from "./use-targets-panel";

const data: TargetsResponse = {
  period: { periodType: "week", periodStart: "x", isCurrent: true, isFuture: false, canEdit: true },
  executives: [
    { userId: "u1", name: "Asha", perf: { periodStart: "x", oilActual: [], oilTarget: [{ segment: "Car", litres: 5 }]}, currentTarget: null },
  ],
};
const config = { apiBaseUrl: "", authToken: "" };
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const setup = () => renderHook(() => useTargetsPanel(config), { wrapper });

beforeEach(() => { vi.clearAllMocks(); apiGet.mockResolvedValue(data); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useTargetsPanel", () => {
  it("loads the current week and flags it current + editable", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith(config, expect.stringContaining("/targets?periodType=week"));
    expect(result.current.isCurrent).toBe(true);
    expect(result.current.canEdit).toBe(true);
  });

  it("stepping back makes the period past + read-only; changePeriod resets to current", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    act(() => result.current.step(-1));
    await waitFor(() => expect(result.current.isPast).toBe(true));
    expect(result.current.canEdit).toBe(false);
    act(() => result.current.changePeriod("month"));
    expect(result.current.period).toBe("month");
    expect(result.current.isCurrent).toBe(true);
  });

  it("stepping forward makes it future; goToCurrent returns to now", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    act(() => result.current.step(1));
    await waitFor(() => expect(result.current.isFuture).toBe(true));
    act(() => result.current.goToCurrent());
    expect(result.current.isCurrent).toBe(true);
  });

  it("copyRow stores the exec's target in the clipboard", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    act(() => result.current.copyRow(result.current.executives[0]));
    expect(result.current.clipboard).toEqual({ oil: expect.objectContaining({ Car: 5 })});
    expect(result.current.copiedId).toBe("u1");
  });

  it("applyAll PUTs for every executive and closes the confirm", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    act(() => result.current.setConfirmAll(true));
    await act(async () => { await result.current.applyAll.mutateAsync({ oil: { Car: 3 }}); });
    expect(apiRequest).toHaveBeenCalledWith(config, "PUT", "/targets/u1", expect.objectContaining({ periodType: "week"}));
    await waitFor(() => expect(result.current.confirmAll).toBe(false));
  });

  it("applyAll surfaces a bulk error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Bulk boom"));
    const { result } = setup();
    await waitFor(() => expect(result.current.executives).toHaveLength(1));
    await act(async () => {
      await result.current.applyAll.mutateAsync({ oil: {}}).catch(() => {});
    });
    await waitFor(() => expect(result.current.bulkError).toBe("Bulk boom"));
  });
});
