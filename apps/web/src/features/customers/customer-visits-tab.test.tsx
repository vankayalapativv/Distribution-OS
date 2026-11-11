import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/lazy-calendar", () => ({
  LazyCalendar: (p: { onSelect: (r: unknown) => void }) => <button onClick={() => p.onSelect({})}>calendar</button>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  PopoverTrigger: (p: { children: React.ReactNode }) => <button>{p.children}</button>,
  PopoverContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));
vi.mock("./customer-visits-table", () => ({ CustomerVisitsTable: () => <div>visits-table</div> }));

const hook = {
  preset: "all" as string,
  range: { from: null, to: null } as { from: string | null; to: string | null },
  page: 1,
  setPage: vi.fn(),
  calOpen: false,
  onCalOpenChange: vi.fn(),
  query: { isLoading: false },
  data: undefined as unknown,
  summary: { today: 1, week: 2, month: 3, all: 4 },
  applyPreset: vi.fn(),
  onCalendar: vi.fn(),
  pageCount: 1,
  pct: null as number | null,
  pill: null as { bg: string; fg: string } | null,
  feed: [],
};
vi.mock("./use-customer-visits", () => ({ useCustomerVisits: () => hook }));

import { CustomerVisitsTab } from "./customer-visits-tab";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof hook> = {}) => {
  Object.assign(hook, {
    preset: "all", range: { from: null, to: null }, page: 1, query: { isLoading: false },
    data: undefined, pct: null, pill: null, pageCount: 1,
  }, over);
  hook.applyPreset.mockClear();
  hook.setPage.mockClear();
};

describe("CustomerVisitsTab", () => {
  it("shows shimmer tiles before data and applies a preset on tile click", () => {
    reset();
    render(<CustomerVisitsTab customerId="c1" actionConfig={cfg} />);
    expect(screen.getByText("visits-table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /This week/ }));
    expect(hook.applyPreset).toHaveBeenCalledWith("week");
  });

  it("shows tile counts, the role-split chips, and the custom-range label when data is loaded", () => {
    reset({
      data: {
        total: 4,
        productive: 3,
        page: 1,
        byRole: {
          executive: { total: 4, productive: 3, avgDurationMinutes: 24 },
          admin: { total: 1, productive: 1, avgDurationMinutes: 31 },
        },
      },
      preset: "custom",
      range: { from: "2026-06-01", to: "2026-06-10" },
    });
    render(<CustomerVisitsTab customerId="c1" actionConfig={cfg} />);
    expect(screen.getByText("4")).toBeInTheDocument(); // all-time count
    // Productivity split: executive 3/4 = 75%, admin 1/1 = 100%.
    expect(screen.getByText("Exec 75%")).toBeInTheDocument();
    expect(screen.getByText("Admin 100%")).toBeInTheDocument();
    // Avg-time split.
    expect(screen.getByText("Exec 24 min")).toBeInTheDocument();
    expect(screen.getByText("Admin 31 min")).toBeInTheDocument();
    expect(screen.getByText("2026-06-01 – 2026-06-10")).toBeInTheDocument();
  });

  it("paginates when there are more than 8 visits", () => {
    reset({ data: { total: 20, page: 2, productive: 0 }, page: 2, pageCount: 3 });
    render(<CustomerVisitsTab customerId="c1" actionConfig={cfg} />);
    expect(screen.getByText("Page 2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(hook.setPage).toHaveBeenCalledTimes(2);
    // the updaters step the page by ±1
    expect(hook.setPage.mock.calls[0][0](5)).toBe(4);
    expect(hook.setPage.mock.calls[1][0](5)).toBe(6);
  });

  it("uses the singular 'visit' label for a single visit", () => {
    reset({ data: { total: 1, page: 1, productive: 0 } });
    render(<CustomerVisitsTab customerId="c1" actionConfig={cfg} />);
    expect(screen.getByText("1 visit")).toBeInTheDocument();
  });

  it("hides pagination for a single page", () => {
    reset({ data: { total: 4, page: 1, productive: 0 } });
    render(<CustomerVisitsTab customerId="c1" actionConfig={cfg} />);
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });
});
