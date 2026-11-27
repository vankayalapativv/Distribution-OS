import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReimbursementPayable } from "./reimbursements-api";

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { title: string; description: React.ReactNode; confirmLabel: string; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) => (
    <div>
      <h1>{p.title}</h1>
      <p>{p.description}</p>
      {p.extra}
      <button onClick={() => void p.onConfirm()}>{p.confirmLabel}</button>
    </div>
  ),
}));

import { SettleDialog } from "./settle-dialog";

const payable = { id: "p1", userName: "Priya", amount: 450 } as ReimbursementPayable;
const onPay = vi.fn(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (p: ReimbursementPayable | null) =>
  render(<SettleDialog payable={p} onOpenChange={onOpenChange} onPay={onPay} />);
afterEach(() => vi.clearAllMocks());

describe("SettleDialog", () => {
  it("renders nothing without a payable", () => {
    const { container } = render2(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to cash and pays with the chosen mode", () => {
    render2(payable);
    expect(screen.getByText("Mark reimbursement paid")).toBeInTheDocument();
    const select = screen.getByLabelText("Paid via") as HTMLSelectElement;
    expect(select.value).toBe("cash");
    fireEvent.change(select, { target: { value: "upi" } });
    fireEvent.click(screen.getByText("Mark paid"));
    expect(onPay).toHaveBeenCalledWith("p1", "upi");
  });

  it("falls back to 'the employee' when the name is unknown", () => {
    render2({ ...payable, userName: null });
    expect(screen.getByText(/Pay the employee/)).toBeInTheDocument();
  });

  it("resets the mode when the target changes", () => {
    const { rerender } = render2(payable);
    fireEvent.change(screen.getByLabelText("Paid via"), { target: { value: "bank_transfer" } });
    rerender(<SettleDialog payable={{ ...payable, id: "p2" }} onOpenChange={onOpenChange} onPay={onPay} />);
    expect((screen.getByLabelText("Paid via") as HTMLSelectElement).value).toBe("cash");
  });
});
