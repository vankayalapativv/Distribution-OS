import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";

const useMyClaims = vi.fn();
const reimb = { owedTotal: 0 };
const adv = { outstandingTotal: 0 };
const sal = { pay: null as { monthlySalary: number | null; advanceOutstanding: number; thisMonth: null } | null };
vi.mock("../../../lib/use-my-claims", () => ({ useMyClaims: () => useMyClaims() }));
vi.mock("../../../lib/use-my-reimbursements", () => ({ useMyReimbursements: () => reimb }));
vi.mock("../../../lib/use-my-advances", () => ({ useMyAdvances: () => adv }));
vi.mock("../../../lib/use-my-salary", () => ({ useMySalary: () => sal }));
vi.mock("expo-router", () => ({ router: { push: vi.fn(), back: vi.fn() } }));
vi.mock("../../../components/error-state", () => ({ ErrorState: () => <span>error-state</span> }));
vi.mock("../../../components/expenses/claim-row", () => ({
  ClaimRow: ({ claim, onPress }: { claim: { id: string }; onPress: (c: unknown) => void }) => (
    <span onClick={() => onPress(claim)}>claim-{claim.id}</span>
  ),
}));

import MyExpensesScreen from "./index";

const base = { claims: [], loading: false, error: null, retry: vi.fn(), refreshing: false, onRefresh: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); reimb.owedTotal = 0; adv.outstandingTotal = 0; sal.pay = null; useMyClaims.mockReturnValue({ ...base }); });

describe("MyExpensesScreen", () => {
  it("shows the empty state, routes to New, and goes back", () => {
    render(<MyExpensesScreen />);
    expect(screen.getByText("No claims yet")).toBeInTheDocument();
    fireEvent.click(screen.getByText("＋ New"));
    expect(router.push).toHaveBeenCalledWith("/settings/expenses/new");
    fireEvent.click(screen.getByText("‹"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows the owed-to-you balance when the company owes the SE", () => {
    reimb.owedTotal = 450;
    render(<MyExpensesScreen />);
    expect(screen.getByText("Company owes you")).toBeInTheDocument();
    expect(screen.getByText("₹450")).toBeInTheDocument();
  });

  it("shows the salary card when a salary is set", () => {
    sal.pay = { monthlySalary: 20000, advanceOutstanding: 0, thisMonth: null };
    render(<MyExpensesScreen />);
    expect(screen.getByText("Monthly salary")).toBeInTheDocument();
    expect(screen.getByText("₹20,000")).toBeInTheDocument();
  });

  it("shows advance outstanding and routes to the request screen", () => {
    adv.outstandingTotal = 8000;
    render(<MyExpensesScreen />);
    expect(screen.getByText("Advance to repay")).toBeInTheDocument();
    expect(screen.getByText("₹8,000")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Request an advance"));
    expect(router.push).toHaveBeenCalledWith("/settings/expenses/advance");
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
