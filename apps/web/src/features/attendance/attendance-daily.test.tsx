import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyAttendanceResponse } from "./attendance-api";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a) };
});
const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (opts: unknown) => useQuery(opts) }));
vi.mock("./attendance-daily-timeline", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AttendanceDailyTimeline: ({ rows, isLoading }: any) => <div>timeline rows={rows.length} loading={String(isLoading)}</div>,
}));

import { AttendanceDaily } from "./attendance-daily";

// 3 SEs: two started (one still on field), one absent.
const data: DailyAttendanceResponse = {
  date: "2026-07-28",
  rows: [
    { userId: "u1", name: "Asha", startTime: "2026-07-28T03:30:00Z", endTime: "2026-07-28T13:00:00Z", startOdometer: 1000, endOdometer: 1050, present: true },
    { userId: "u2", name: "Ravi", startTime: "2026-07-28T04:00:00Z", endTime: null, startOdometer: null, endOdometer: null, present: true },
    { userId: "u3", name: "Sunil", startTime: null, endTime: null, startOdometer: null, endOdometer: null, present: false },
  ],
  summary: { total: 3, present: 2, absent: 1 },
};
const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => { vi.clearAllMocks(); useQuery.mockReturnValue({ data, isLoading: false, isError: false }); });
afterEach(() => vi.restoreAllMocks());

describe("AttendanceDaily", () => {
  it("renders KPI tiles from the rows and passes rows to the timeline", () => {
    render(<AttendanceDaily actionConfig={config} date="2026-07-28" />);
    expect(screen.getByText("Checked in")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument(); // 2 of 3 checked in
    expect(screen.getByText("timeline rows=3 loading=false")).toBeInTheDocument();
  });

  it("keys the query on the date prop (re-runs when it changes)", () => {
    const { rerender } = render(<AttendanceDaily actionConfig={config} date="2026-07-28" />);
    expect(useQuery.mock.calls.at(-1)![0].queryKey).toEqual(["attendance-daily", "2026-07-28"]);
    rerender(<AttendanceDaily actionConfig={config} date="2026-07-01" />);
    expect(useQuery.mock.calls.at(-1)![0].queryKey).toEqual(["attendance-daily", "2026-07-01"]);
  });

  it("its queryFn calls apiGet for the daily endpoint", () => {
    render(<AttendanceDaily actionConfig={config} date="2026-07-28" />);
    const { queryFn } = useQuery.mock.calls.at(-1)![0];
    queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, expect.stringContaining("/attendance/daily?date="));
  });

  it("shows loading skeletons and an empty timeline before data arrives", () => {
    useQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<AttendanceDaily actionConfig={config} date="2026-07-28" />);
    expect(screen.getByText("timeline rows=0 loading=true")).toBeInTheDocument();
  });
});
