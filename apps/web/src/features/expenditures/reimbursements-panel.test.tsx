import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReimbursementPayable } from "./reimbursements-api";

const canPay = { value: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: () => canPay.value }));
const data = {
  owed: [] as ReimbursementPayable[],
  total: 0,
  peopleCount: 0,
  isLoading: false,
  markPaid: vi.fn(() => Promise.resolve()),
};
vi.mock("./use-reimbursements", () => ({ useReimbursements: () => data }));
vi.mock("./settle-dialog", () => ({
  SettleDialog: ({ payable, onOpenChange, onPay }: { payable: { id: string } | null; onOpenChange: (o: boolean) => void; onPay: (id: string, m: string) => Promise<void> }) =>
    payable ? (
      <div>
        SETTLE:{payable.id}
        <button onClick={() => void onPay(payable.id, "cash")}>do-pay</button>
        <button onClick={() => onOpenChange(false)}>close-settle</button>
      </div>
    ) : null,
}));

import { ReimbursementsPanel } from "./reimbursements-panel";

const payable = (over: Partial<ReimbursementPayable> = {}): ReimbursementPayable => ({
  id: "p1", userId: "u1", userName: "Priya", amount: 450, status: "owed",
  categoryName: "Fuel", code: "EXP-7", date: "2026-11-28", paymentMode: null, paidAt: null, createdAt: "2026-11-28", ...over,
});
const config = { apiBaseUrl: "", authToken: "" };
const renderPanel = () => render(<ReimbursementsPanel actionConfig={config} />);

beforeEach(() => {
  vi.clearAllMocks();
  canPay.value = true; data.isLoading = false;
  data.owed = [payable(), payable({ id: "p2", userId: "u2", userName: null, amount: 100 })];
  data.total = 550; data.peopleCount = 2;
});
afterEach(() => vi.clearAllMocks());

describe("ReimbursementsPanel", () => {
  it("hides when the user can't pay", () => {
    canPay.value = false;
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("hides while loading and when nothing is owed", () => {
    data.isLoading = true;
    const { container, rerender } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    data.isLoading = false; data.owed = [];
    rerender(<ReimbursementsPanel actionConfig={config} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists owed payables with a total + people count", () => {
    renderPanel();
    expect(screen.getByText(/Reimbursements to pay — ₹550 to 2 people/)).toBeInTheDocument();
    expect(screen.getByText(/Priya · ₹450/)).toBeInTheDocument();
    expect(screen.getByText(/— · ₹100/)).toBeInTheDocument(); // null userName → dash
  });

  it("singularises the people count", () => {
    data.owed = [payable()]; data.peopleCount = 1; data.total = 450;
    renderPanel();
    expect(screen.getByText(/to 1 person/)).toBeInTheDocument();
  });

  it("opens the settle dialog, pays, and closes", () => {
    renderPanel();
    fireEvent.click(screen.getAllByText("Mark paid")[0]);
    expect(screen.getByText("SETTLE:p1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("do-pay"));
    expect(data.markPaid).toHaveBeenCalledWith("p1", "cash");
    fireEvent.click(screen.getByText("close-settle"));
    expect(screen.queryByText("SETTLE:p1")).not.toBeInTheDocument();
  });
});
