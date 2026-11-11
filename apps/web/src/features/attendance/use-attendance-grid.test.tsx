import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AttendanceGridResponse } from "./attendance-api";
import type { EditTarget } from "./attendance-cell-dialog";

const apiGet = vi.fn();
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});

import { useAttendanceGrid } from "./use-attendance-grid";

const config = { apiBaseUrl: "", authToken: "" };
const gridData: AttendanceGridResponse = {
  month: "2026-07",
  days: ["2026-07-01", "2026-07-02"],
  rows: [{ userId: "u1", name: "Asha", days: [] }],
};
const editTarget: EditTarget = {
  userId: "u1", name: "Asha",
  cell: { date: "2026-07-01", status: "present", manual: false, tracked: true, startTime: null, endTime: null, startOdometer: null, endOdometer: null, note: null },
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const setup = () => renderHook(() => useAttendanceGrid(config, "2026-07"), { wrapper });

beforeEach(() => { vi.clearAllMocks(); apiGet.mockResolvedValue(gridData); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useAttendanceGrid", () => {
  it("loads the given month's grid and derives dayMeta", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(apiGet).toHaveBeenCalledWith(config, "/attendance/grid?month=2026-07");
    expect(result.current.dayMeta.map((m) => m.day)).toEqual([1, 2]);
  });

  it("saveCell PUTs the edited cell", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setEdit(editTarget));
    await act(async () => { result.current.saveCell("leave", "PL"); });
    expect(apiRequest).toHaveBeenCalledWith(config, "PUT", "/attendance", {
      userId: "u1", date: "2026-07-01", status: "leave", note: "PL",
    });
    await waitFor(() => expect(result.current.edit).toBeNull());
  });

  it("clearCell DELETEs the override", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setEdit(editTarget));
    await act(async () => { result.current.clearCell(); });
    expect(apiRequest).toHaveBeenCalledWith(config, "DELETE", "/attendance?userId=u1&date=2026-07-01");
  });

  it("surfaces a save error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Save failed"));
    const { result } = setup();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.setEdit(editTarget));
    await act(async () => { result.current.saveCell("absent", ""); });
    await waitFor(() => expect(result.current.error).toBe("Save failed"));
  });
});
