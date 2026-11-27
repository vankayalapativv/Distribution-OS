import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SalaryRow } from "./salary-api";

const can = { view: true, manage: true, void: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: (k: string) => (k.includes("void") ? can.void : k.includes("manage") ? can.manage : can.view) }));
const data = {
  rows: [] as SalaryRow[], staff: [{ id: "u1", name: "Priya" }], isLoading: false,
  setSalary: vi.fn(() => Promise.resolve()), paySalary: vi.fn(() => Promise.resolve()), voidSalary: vi.fn(() => Promise.resolve()),
};
vi.mock("./use-salary", () => ({ useSalary: () => data }));
vi.mock("./set-salary-dialog", () => ({
  SetSalaryDialog: ({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (u: string, a: number, e: null) => Promise<void> }) =>
    open ? <div>SET<button onClick={() => void onSave("u1", 1, null)}>do-set</button><button onClick={() => onOpenChange(false)}>close-set</button></div> : null,
}));
vi.mock("./pay-salary-dialog", () => ({
  PaySalaryDialog: ({ row, onOpenChange, onPay }: { row: { userId: string } | null; onOpenChange: (o: boolean) => void; onPay: (u: string, p: string, m: string) => Promise<void> }) =>
    row ? <div>PAY:{row.userId}<button onClick={() => void onPay(row.userId, "2026-11-01", "cash")}>do-pay</button><button onClick={() => onOpenChange(false)}>close-pay</button></div> : null,
}));
vi.mock("./void-reason-dialog", () => ({
  VoidReasonDialog: ({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (r: string | null) => Promise<void> }) =>
    open ? <div>VOID<button onClick={() => void onConfirm("oops")}>do-void</button><button onClick={() => onOpenChange(false)}>close-void</button></div> : null,
}));

import { SalaryPanel } from "./salary-panel";

const r = (over: Partial<SalaryRow> = {}): SalaryRow => ({ userId: "u1", userName: "Priya", salary: 20000, advanceOutstanding: 8000, paidThisMonth: false, paymentId: null, ...over });
const config = { apiBaseUrl: "", authToken: "" };
const renderPanel = () => render(<SalaryPanel actionConfig={config} />);

beforeEach(() => { vi.clearAllMocks(); can.view = true; can.manage = true; can.void = true; data.isLoading = false; data.rows = [r()]; });
afterEach(() => vi.clearAllMocks());

describe("SalaryPanel", () => {
  it("hides without salary.view", () => {
    can.view = false;
    expect(renderPanel().container).toBeEmptyDOMElement();
  });

  it("hides while loading", () => {
    data.isLoading = true;
    expect(renderPanel().container).toBeEmptyDOMElement();
  });

  it("shows an empty note when no salaries are set", () => {
    data.rows = [];
    renderPanel();
    expect(screen.getByText("No salaries set yet.")).toBeInTheDocument();
  });

  it("lists salaries, opens set + pay, and wires the actions", () => {
    renderPanel();
    expect(screen.getByText(/Priya · ₹20,000/)).toBeInTheDocument();
    expect(screen.getByText(/₹8,000 advance outstanding · not paid this month/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Set salary"));
    fireEvent.click(screen.getByText("do-set"));
    expect(data.setSalary).toHaveBeenCalledWith("u1", 1, null);
    fireEvent.click(screen.getByText("close-set"));
    fireEvent.click(screen.getByText("Pay"));
    expect(screen.getByText("PAY:u1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("do-pay"));
    expect(data.paySalary).toHaveBeenCalledWith("u1", "2026-11-01", "cash");
    fireEvent.click(screen.getByText("close-pay"));
  });

  it("reverses a paid run (named or not), and hides Reverse without the grant or a payment id", () => {
    data.rows = [r({ paidThisMonth: true, paymentId: "pay-1" }), r({ userId: "u2", userName: null, paidThisMonth: true, paymentId: "pay-2" })];
    const { rerender } = renderPanel();
    const buttons = screen.getAllByText("Reverse");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]); // null-name row → "the employee" fallback
    fireEvent.click(screen.getByText("close-void"));
    fireEvent.click(buttons[0]); // Priya
    expect(screen.getByText("VOID")).toBeInTheDocument();
    fireEvent.click(screen.getByText("do-void"));
    expect(data.voidSalary).toHaveBeenCalledWith("pay-1", "oops");
    // no void grant → no Reverse; paid but no payment id → no Reverse
    can.void = false;
    rerender(<SalaryPanel actionConfig={config} />);
    expect(screen.queryByText("Reverse")).not.toBeInTheDocument();
    can.void = true; data.rows = [r({ paidThisMonth: true, paymentId: null })];
    rerender(<SalaryPanel actionConfig={config} />);
    expect(screen.queryByText("Reverse")).not.toBeInTheDocument();
  });

  it("hides Set/Pay without salary.manage, and the Pay button once paid or unset", () => {
    can.manage = false;
    const { rerender } = renderPanel();
    expect(screen.queryByText("Set salary")).not.toBeInTheDocument();
    expect(screen.queryByText("Pay")).not.toBeInTheDocument();
    can.manage = true; data.rows = [r({ paidThisMonth: true }), r({ userId: "u2", userName: null, salary: null, advanceOutstanding: 0 })];
    rerender(<SalaryPanel actionConfig={config} />);
    expect(screen.queryByText("Pay")).not.toBeInTheDocument(); // paid, and the other has no salary
    expect(screen.getByText(/— · salary not set/)).toBeInTheDocument(); // null name + null salary + no advance note
  });
});
