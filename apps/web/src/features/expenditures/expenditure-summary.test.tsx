import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenditureSummary } from "./expenditures-api";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a) };
});
const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (o: unknown) => useQuery(o) }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>CHART</div> }));
vi.mock("./expenditure-summary-cards", () => ({ ExpenditureSummaryCards: () => <div>CARDS</div> }));

import { ExpenditureSummaryPanel } from "./expenditure-summary";

const data: ExpenditureSummary = {
  total: 1000, compulsory: 600, variable: 400, entries: 5,
  categories: [{ categoryId: "c1", categoryName: "Rent", type: "compulsory", entries: 1, amount: 600 }],
};
const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("ExpenditureSummaryPanel", () => {
  it("shows a skeleton while loading (no cards yet)", () => {
    useQuery.mockReturnValue({ isLoading: true, data: undefined });
    const { container } = render(<ExpenditureSummaryPanel actionConfig={config} from="a" to="b" />);
    expect(container.querySelectorAll(".rounded-lg").length).toBe(4);
    expect(screen.queryByText("CARDS")).not.toBeInTheDocument();
  });

  it("renders cards + the breakdown chart once loaded", () => {
    useQuery.mockReturnValue({ isLoading: false, data });
    render(<ExpenditureSummaryPanel actionConfig={config} from="a" to="b" />);
    expect(screen.getByText("CARDS")).toBeInTheDocument();
    expect(screen.getByText("Breakdown by category")).toBeInTheDocument();
  });

  it("renders nothing when there is no data; its queryFn hits the summary endpoint", () => {
    useQuery.mockReturnValue({ isLoading: false, data: undefined });
    const { container } = render(<ExpenditureSummaryPanel actionConfig={config} from="2026-07-01" to="2026-07-31" />);
    expect(container.textContent).toBe("");
    const { queryFn } = useQuery.mock.calls.at(-1)![0];
    queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, expect.stringContaining("/expenditures/summary?from=2026-07-01"));
  });

  it("hides the chart when there are no categories", () => {
    useQuery.mockReturnValue({ isLoading: false, data: { ...data, categories: [] } });
    render(<ExpenditureSummaryPanel actionConfig={config} from="a" to="b" />);
    expect(screen.queryByText("Breakdown by category")).not.toBeInTheDocument();
  });
});
