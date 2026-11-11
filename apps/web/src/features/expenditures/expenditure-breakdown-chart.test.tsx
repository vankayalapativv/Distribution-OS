import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenditureSummary } from "./expenditures-api";

// Recharts needs real layout; stub its primitives so the component's own logic
// (buildSlices → config, the centre label, the tooltip formatter) is exercised.
vi.mock("recharts", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PieChart: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Pie: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Label: ({ content }: any) => <div>{content({ viewBox: { cx: 10, cy: 10 } })}</div>,
}));
vi.mock("@/components/ui/chart", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartLegend: () => <div>legend</div>,
  ChartLegendContent: () => null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChartTooltip: ({ content }: any) => <div>{content}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChartTooltipContent: ({ formatter }: any) => <div>{formatter(250, "Rent")}</div>,
}));

import ExpenditureBreakdownChart from "./expenditure-breakdown-chart";

const summary: ExpenditureSummary = {
  total: 1000, compulsory: 600, variable: 400, entries: 5,
  categories: [{ categoryId: "c1", categoryName: "Rent", type: "compulsory", entries: 1, amount: 600 }],
};

describe("ExpenditureBreakdownChart", () => {
  it("renders the centre total and the tooltip's amount + share", () => {
    render(<ExpenditureBreakdownChart summary={summary} />);
    expect(screen.getByText("total spend")).toBeInTheDocument();
    // Centre label shows the grand total; tooltip shows a slice amount + %.
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0);
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText(/\(25%\)/)).toBeInTheDocument(); // 250 / 1000
  });

  it("renders a 0% share when the total is zero", () => {
    render(<ExpenditureBreakdownChart summary={{ ...summary, total: 0 }} />);
    expect(screen.getByText(/\(0%\)/)).toBeInTheDocument();
  });
});
