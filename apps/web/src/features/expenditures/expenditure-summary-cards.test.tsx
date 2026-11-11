import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenditureSummaryCards } from "./expenditure-summary-cards";
import type { ExpenditureSummary } from "./expenditures-api";

const data = (over: Partial<ExpenditureSummary> = {}): ExpenditureSummary => ({
  total: 1000, compulsory: 600, variable: 400, entries: 5,
  categories: [{ categoryId: "c1", categoryName: "Rent", type: "compulsory", entries: 1, amount: 600 }],
  ...over,
});

describe("ExpenditureSummaryCards", () => {
  it("shows the four figures and the compulsory/variable percentages", () => {
    render(<ExpenditureSummaryCards data={data()} />);
    expect(screen.getByText("Total spend")).toBeInTheDocument();
    expect(screen.getByText("5 entries")).toBeInTheDocument();
    expect(screen.getByText("60% of total")).toBeInTheDocument(); // compulsory 600/1000
    expect(screen.getByText("40% of total")).toBeInTheDocument(); // variable 400/1000
    expect(screen.getByText("1")).toBeInTheDocument(); // categories used
  });

  it("shows 0% shares when the total is zero", () => {
    render(<ExpenditureSummaryCards data={data({ total: 0, compulsory: 0, variable: 0, categories: [] })} />);
    expect(screen.getAllByText("0% of total").length).toBe(2);
  });
});
