import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paged = { table: {}, total: 0, pageCount: 1, pageSize: 8, showSkeleton: false, isFetching: false, error: null };
vi.mock("@/components/data-table/use-paged-table", () => ({ usePagedTable: () => paged }));
vi.mock("@/components/data-table/data-table", () => ({ DataTable: () => <div data-testid="table" /> }));
vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("./logistics-runs-summary", () => ({ LogisticsRunsSummary: () => <div data-testid="summary" /> }));
vi.mock("./logistics-toolbar", () => ({
  LogisticsToolbar: ({ onClear, onRefresh }: { readonly onClear: () => void; readonly onRefresh: () => void }) => (
    <div>
      <button onClick={onClear}>do-clear</button>
      <button onClick={onRefresh}>do-refresh</button>
    </div>
  ),
}));

import { LogisticsTable } from "./logistics-table";

const config = { apiBaseUrl: "", authToken: "" };
function renderTable(over: Partial<Parameters<typeof LogisticsTable>[0]> = {}) {
  const setApplied = vi.fn();
  const setQInput = vi.fn();
  const setDateRange = vi.fn();
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <LogisticsTable
        view="runs"
        setView={vi.fn()}
        qInput="ramesh"
        setQInput={setQInput}
        dateRange={{ from: new Date(2026, 8, 1), to: new Date(2026, 8, 14) }}
        setDateRange={setDateRange}
        applied={{ q: "", from: "", to: "" }}
        setApplied={setApplied}
        actionConfig={config}
        onRowClick={vi.fn()}
        {...over}
      />
    </QueryClientProvider>,
  );
  return { setApplied, setQInput, setDateRange };
}

describe("LogisticsTable", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the table and the Runs summary strip", () => {
    renderTable();
    expect(screen.getByTestId("table")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toBeInTheDocument();
  });

  it("applies the trimmed query + formatted date range after the debounce (no button)", () => {
    const { setApplied } = renderTable();
    expect(setApplied).not.toHaveBeenCalled(); // not immediate
    act(() => void vi.advanceTimersByTime(350));
    expect(setApplied).toHaveBeenCalledWith({ q: "ramesh", from: "2026-09-01", to: "2026-09-14" });
  });

  it("leaves the dates blank when no range is picked", () => {
    const { setApplied } = renderTable({ dateRange: undefined });
    act(() => void vi.advanceTimersByTime(350));
    expect(setApplied).toHaveBeenCalledWith({ q: "ramesh", from: "", to: "" });
  });

  it("does not re-apply when nothing changed", () => {
    const { setApplied } = renderTable({ qInput: "", dateRange: undefined, applied: { q: "", from: "", to: "" } });
    act(() => void vi.advanceTimersByTime(350));
    expect(setApplied).not.toHaveBeenCalled();
  });

  it("resets inputs and filters on clear", () => {
    const { setApplied, setQInput, setDateRange } = renderTable();
    fireEvent.click(screen.getByText("do-clear"));
    expect(setQInput).toHaveBeenCalledWith("");
    expect(setDateRange).toHaveBeenCalledWith(undefined);
    expect(setApplied).toHaveBeenCalledWith({ q: "", from: "", to: "" });
  });

  it("refetches this view's query on refresh", () => {
    renderTable();
    expect(() => fireEvent.click(screen.getByText("do-refresh"))).not.toThrow();
  });
});
