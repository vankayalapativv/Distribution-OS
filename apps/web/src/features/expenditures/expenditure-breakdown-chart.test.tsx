import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpenditureSummary } from "./expenditures-api";
import ExpenditureBreakdownChart from "./expenditure-breakdown-chart";

// jsdom has no layout (clientWidth is 0), which would collapse the treemap to an
// empty 0-width box; stub a real width so tiles are laid out.
function stubWidth(px: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => px });
}
afterEach(() => {
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (HTMLElement.prototype as any).clientWidth;
});

const summary = (over: Partial<ExpenditureSummary> = {}): ExpenditureSummary => ({
  total: 100000,
  compulsory: 90000,
  variable: 10000,
  entries: 10,
  categories: [
    { categoryId: "c1", categoryName: "Salaries", type: "compulsory", entries: 1, amount: 90000 },
    { categoryId: "v1", categoryName: "Fuel", type: "variable", entries: 1, amount: 9900 },
    { categoryId: "v2", categoryName: "Water", type: "variable", entries: 1, amount: 100 }, // tiny → tight tile
  ],
  ...over,
});

describe("ExpenditureBreakdownChart (treemap)", () => {
  it("renders a labelled tile per category + the centred colour key", () => {
    stubWidth(600);
    render(<ExpenditureBreakdownChart summary={summary()} />);
    expect(screen.getByText("Salaries")).toBeInTheDocument();
    expect(screen.getByText("Fuel")).toBeInTheDocument();
    expect(screen.getByText("Water")).toBeInTheDocument();
    // The large tile shows its amount line (not tight); the tiny one is hidden.
    expect(screen.getByText(/90,000/)).toBeInTheDocument();
    expect(screen.getByText("Compulsory")).toBeInTheDocument();
    expect(screen.getByText("Variable")).toBeInTheDocument();
  });

  it("uses ResizeObserver when it is available", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    stubWidth(600);
    render(<ExpenditureBreakdownChart summary={summary()} />);
    expect(screen.getByText("Salaries")).toBeInTheDocument();
  });

  it("renders no tiles when the container has no measurable width", () => {
    stubWidth(0);
    render(<ExpenditureBreakdownChart summary={summary()} />);
    expect(screen.queryByText("Salaries")).not.toBeInTheDocument();
    expect(screen.getByText("Compulsory")).toBeInTheDocument(); // key still renders
  });

  it("renders no tiles when there are no categories", () => {
    stubWidth(600);
    render(<ExpenditureBreakdownChart summary={summary({ categories: [] })} />);
    expect(screen.queryByText("Salaries")).not.toBeInTheDocument();
    expect(screen.getByText("Variable")).toBeInTheDocument();
  });
});
