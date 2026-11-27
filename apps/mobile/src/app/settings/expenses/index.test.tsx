import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useMyClaims = vi.fn();
vi.mock("../../../lib/use-my-claims", () => ({ useMyClaims: () => useMyClaims() }));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), back: vi.fn() } }));
vi.mock("../../../components/error-state", () => ({ ErrorState: () => <span>error-state</span> }));
vi.mock("../../../components/expenses/claim-row", () => ({
  ClaimRow: ({ claim, onPress }: { claim: { id: string }; onPress: (c: unknown) => void }) => (
    <span onClick={() => onPress(claim)}>claim-{claim.id}</span>
  ),
}));

import MyExpensesScreen from "./index";

const base = { claims: [], loading: false, error: null, retry: vi.fn(), refreshing: false, onRefresh: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); useMyClaims.mockReturnValue({ ...base }); });

describe("MyExpensesScreen", () => {
  it("shows the empty state, routes to New, and goes back", () => {
    render(<MyExpensesScreen />);
    expect(screen.getByText("No claims yet")).toBeInTheDocument();
    fireEvent.click(screen.getByText("＋ New"));
    expect(router.push).toHaveBeenCalledWith("/settings/expenses/new");
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a spinner while loading (no empty state)", () => {
    useMyClaims.mockReturnValue({ ...base, loading: true });
    render(<MyExpensesScreen />);
    expect(screen.queryByText("No claims yet")).not.toBeInTheDocument();
  });

  it("shows the error state", () => {
    useMyClaims.mockReturnValue({ ...base, error: new Error("x") });
    render(<MyExpensesScreen />);
    expect(screen.getByText("error-state")).toBeInTheDocument();
  });

  it("lists claims; tapping a rejected one opens the edit form; a submitted one does nothing", () => {
    useMyClaims.mockReturnValue({
      ...base,
      claims: [{ id: "r1", status: "rejected" }, { id: "s1", status: "submitted" }],
    });
    render(<MyExpensesScreen />);
    fireEvent.click(screen.getByText("claim-s1"));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("claim-r1"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/settings/expenses/new", params: { id: "r1" } });
  });
});
