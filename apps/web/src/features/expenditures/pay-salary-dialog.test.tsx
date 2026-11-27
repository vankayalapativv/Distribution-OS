import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SalaryRow } from "./salary-api";

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { title: string; description: React.ReactNode; confirmLabel: string; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) => (
    <div><h1>{p.title}</h1><p>{p.description}</p>{p.extra}<button onClick={() => void p.onConfirm()}>{p.confirmLabel}</button></div>
  ),
}));

import { PaySalaryDialog } from "./pay-salary-dialog";

const row = (over: Partial<SalaryRow> = {}): SalaryRow => ({ userId: "u1", userName: "Priya", salary: 20000, advanceOutstanding: 8000, paidThisMonth: false, ...over });
const onPay = vi.fn<(userId: string, period: string, mode: string) => Promise<void>>(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (r: SalaryRow | null) => render(<PaySalaryDialog row={r} onOpenChange={onOpenChange} onPay={onPay} />);
afterEach(() => vi.clearAllMocks());

describe("PaySalaryDialog", () => {
  it("renders nothing without a row", () => {
    expect(render2(null).container).toBeEmptyDOMElement();
  });

  it("shows the gross + advance and pays with the chosen mode for this month", () => {
    render2(row());
    expect(screen.getByText(/Priya · gross ₹20,000 · up to ₹8,000 advance recovered/)).toBeInTheDocument();
    const select = screen.getByLabelText("Paid via") as HTMLSelectElement;
    expect(select.value).toBe("bank_transfer");
    fireEvent.change(select, { target: { value: "cash" } });
    fireEvent.click(screen.getByRole("button", { name: "Pay salary" }));
    const [, period, mode] = onPay.mock.calls[0];
    expect(onPay.mock.calls[0][0]).toBe("u1");
    expect(period).toMatch(/^\d{4}-\d{2}-01$/);
    expect(mode).toBe("cash");
  });

  it("falls back for a missing name/salary and omits the advance note", () => {
    render2(row({ userName: null, salary: null, advanceOutstanding: 0 }));
    expect(screen.getByText(/Employee · gross —/)).toBeInTheDocument();
    expect(screen.queryByText(/advance recovered/)).not.toBeInTheDocument();
  });

  it("resets the mode when the target changes", () => {
    const { rerender } = render2(row());
    fireEvent.change(screen.getByLabelText("Paid via"), { target: { value: "upi" } });
    rerender(<PaySalaryDialog row={row({ userId: "u2" })} onOpenChange={onOpenChange} onPay={onPay} />);
    expect((screen.getByLabelText("Paid via") as HTMLSelectElement).value).toBe("bank_transfer");
  });
});
