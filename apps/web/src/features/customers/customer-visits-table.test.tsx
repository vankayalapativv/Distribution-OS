import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./customer-visit-rows", () => ({
  MissedBeatRow: () => <tr><td>missed-row</td></tr>,
  VisitTableRow: (p: { row: { id: string } }) => <tr><td>visit-{p.row.id}</td></tr>,
}));

import { CustomerVisitsTable } from "./customer-visits-table";
import type { FeedRow, VisitsData } from "./customer-visits-logic";

const data = { total: 2 } as VisitsData;

describe("CustomerVisitsTable", () => {
  it("renders skeleton rows while loading", () => {
    const { container } = render(<CustomerVisitsTable isLoading data={undefined} feed={[]} />);
    // 8 skeleton rows in the body
    expect(container.querySelectorAll("tbody tr")).toHaveLength(8);
  });

  it("renders the empty state when loaded with no feed", () => {
    render(<CustomerVisitsTable isLoading={false} data={data} feed={[]} />);
    expect(screen.getByText(/No check-ins recorded/)).toBeInTheDocument();
  });

  it("renders visit + missed rows from the feed", () => {
    const feed: FeedRow[] = [
      { kind: "visit", ts: 2, visit: { id: "v1" } as never },
      { kind: "missed", ts: 1, missed: { date: "d" } as never },
    ];
    render(<CustomerVisitsTable isLoading={false} data={data} feed={feed} />);
    expect(screen.getByText("visit-v1")).toBeInTheDocument();
    expect(screen.getByText("missed-row")).toBeInTheDocument();
  });
});
