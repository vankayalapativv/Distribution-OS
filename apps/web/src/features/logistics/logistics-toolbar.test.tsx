import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/lazy-calendar", () => ({ LazyCalendar: () => <div data-testid="cal" /> }));

import { LogisticsToolbar } from "./logistics-toolbar";

function renderToolbar(over: Partial<Parameters<typeof LogisticsToolbar>[0]> = {}) {
  const props = {
    view: "runs" as const,
    setView: vi.fn(),
    qInput: "",
    setQInput: vi.fn(),
    dateRange: undefined,
    setDateRange: vi.fn(),
    onClear: vi.fn(),
    onRefresh: vi.fn(),
    isFetching: false,
    isLoading: false,
    total: 24,
    ...over,
  };
  render(<LogisticsToolbar {...props} />);
  return props;
}

describe("LogisticsToolbar", () => {
  it("shows all three view tabs and switches view", () => {
    const p = renderToolbar();
    fireEvent.click(screen.getByText("By customer"));
    expect(p.setView).toHaveBeenCalledWith("customers");
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("By delivery")).toBeInTheDocument();
  });

  it("updates the query as the user types (no Search button)", () => {
    const p = renderToolbar();
    const input = screen.getByPlaceholderText("Search driver or vehicle…");
    fireEvent.change(input, { target: { value: "ramesh" } });
    expect(p.setQInput).toHaveBeenCalledWith("ramesh");
    // There is no manual Search button any more.
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });

  it("fires clear and refresh from their buttons", () => {
    const p = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByTitle("Refresh"));
    expect(p.onClear).toHaveBeenCalled();
    expect(p.onRefresh).toHaveBeenCalled();
  });

  it("shows the count with the view's noun, or Loading…", () => {
    renderToolbar();
    expect(screen.getByText("24 runs")).toBeInTheDocument();
  });

  it("shows Loading… while loading", () => {
    renderToolbar({ isLoading: true });
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the picked date range label", () => {
    renderToolbar({ dateRange: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 14) } });
    expect(screen.getByText(/01 Sep – 14 Sep 2026/)).toBeInTheDocument();
  });

  it("shows a single-day range label", () => {
    renderToolbar({ dateRange: { from: new Date(2026, 8, 1), to: undefined } });
    expect(screen.getByText(/01 Sep 2026/)).toBeInTheDocument();
  });
});
