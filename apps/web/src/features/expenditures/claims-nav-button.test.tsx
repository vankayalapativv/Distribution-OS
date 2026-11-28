import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can = { approve: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: () => can.approve }));
const q = { data: undefined as { expenditureClaimsPending: number } | undefined };
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryFn?: () => unknown }) => { c?.queryFn?.(); return { data: q.data }; },
}));
const fetchBadgeCounts = vi.fn();
vi.mock("@/features/shell/badge-fetch", () => ({ fetchBadgeCounts: () => fetchBadgeCounts() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ClaimsNavButton } from "./claims-nav-button";

beforeEach(() => { vi.clearAllMocks(); can.approve = true; q.data = { expenditureClaimsPending: 0 }; });
afterEach(() => vi.clearAllMocks());

describe("ClaimsNavButton", () => {
  it("renders nothing without the approve permission", () => {
    can.approve = false;
    expect(render(<ClaimsNavButton />).container).toBeEmptyDOMElement();
  });

  it("shows the pending-count badge from badge-counts and opens the Claims page", () => {
    q.data = { expenditureClaimsPending: 2 };
    render(<ClaimsNavButton />);
    expect(fetchBadgeCounts).toHaveBeenCalled(); // the shared source, not a claims-list fetch
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Claims"));
    expect(push).toHaveBeenCalledWith("/expenditures/claims");
  });

  it("shows no badge when nothing is pending", () => {
    render(<ClaimsNavButton />);
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("defaults to 0 pending before the query resolves", () => {
    q.data = undefined;
    render(<ClaimsNavButton />);
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.queryByText(/^[1-9]/)).not.toBeInTheDocument();
  });
});
