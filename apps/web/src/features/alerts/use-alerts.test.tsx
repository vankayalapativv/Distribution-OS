import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
const refreshBadges = vi.fn();
vi.mock("@/features/shell/badge-refresh", () => ({ refreshBadges: () => refreshBadges() }));

// Controllable URL mock.
let sp = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/alerts",
}));

import { useAlerts } from "./use-alerts";
import type { Alert } from "./alerts-api";

const alert = (over: Partial<Alert> = {}): Alert =>
  ({ id: "a1", alertDate: "2026-09-14", alertType: "CREDIT_OVERDUE", severity: "high", customerId: null,
     customerName: null, executiveId: null, executiveName: null, alertMessage: "msg", recommendedAction: null,
     status: "open", closedAt: null, createdAt: "2026-09-14T00:00:00Z", ...over } as Alert);
const seed = [alert({ id: "a1", status: "open" }), alert({ id: "a2", status: "closed" })];
const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => { sp = new URLSearchParams(); replace.mockClear(); });
afterEach(() => { apiRequest.mockReset(); refreshBadges.mockReset(); });

describe("useAlerts", () => {
  it("defaults to the open filter and counts open alerts", () => {
    const { result } = renderHook(() => useAlerts(seed, config));
    expect(result.current.statusFilter).toBe("open");
    expect(result.current.filtered.map((a) => a.id)).toEqual(["a1"]);
    expect(result.current.openCount).toBe(1);
  });

  it("derives the filter from the URL (?status=all / ?status=closed)", () => {
    sp = new URLSearchParams("status=all");
    const { result: all } = renderHook(() => useAlerts(seed, config));
    expect(all.current.statusFilter).toBe("all");
    expect(all.current.filtered).toHaveLength(2);
    sp = new URLSearchParams("status=closed");
    const { result: closed } = renderHook(() => useAlerts(seed, config));
    expect(closed.current.filtered.map((a) => a.id)).toEqual(["a2"]);
  });

  it("setStatusFilter writes the status to the URL (open = clean URL)", () => {
    const { result } = renderHook(() => useAlerts(seed, config));
    act(() => result.current.setStatusFilter("closed"));
    expect(replace).toHaveBeenCalledWith("/alerts?status=closed", { scroll: false });
    act(() => result.current.setStatusFilter("open"));
    expect(replace).toHaveBeenCalledWith("/alerts", { scroll: false });
  });

  it("closes an alert: replaces it, refreshes badges, clears closingId", async () => {
    apiRequest.mockResolvedValueOnce(alert({ id: "a1", status: "closed" }));
    const { result } = renderHook(() => useAlerts(seed, config));
    await act(async () => result.current.handleClose("a1"));
    await waitFor(() => expect(result.current.openCount).toBe(0));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/alerts/a1/close");
    expect(refreshBadges).toHaveBeenCalled();
    expect(result.current.closingId).toBeNull();
  });

  it("keeps the alert open and stays silent when closing fails", async () => {
    apiRequest.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useAlerts(seed, config));
    await act(async () => result.current.handleClose("a1"));
    await waitFor(() => expect(result.current.closingId).toBeNull());
    expect(result.current.openCount).toBe(1); // unchanged
    expect(refreshBadges).not.toHaveBeenCalled();
  });
});
