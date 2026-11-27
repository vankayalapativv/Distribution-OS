import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { title: string; confirmLabel: string; confirmDisabled: boolean; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) => (
    <div>
      <h1>{p.title}</h1>
      <span>disabled:{String(p.confirmDisabled)}</span>
      {p.extra}
      <button onClick={() => void p.onConfirm()}>{p.confirmLabel}</button>
    </div>
  ),
}));

import { RecordAdvanceDialog } from "./record-advance-dialog";

const people = [{ id: "u1", name: "Priya" }, { id: "u2", name: "Ravi" }];
const onRecord = vi.fn(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (open: boolean) =>
  render(<RecordAdvanceDialog open={open} people={people} onOpenChange={onOpenChange} onRecord={onRecord} />);
afterEach(() => vi.clearAllMocks());

describe("RecordAdvanceDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render2(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("is disabled until a person + amount are set, then records", () => {
    render2(true);
    expect(screen.getByText("disabled:true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Record advance")); // invalid → no-op
    expect(onRecord).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: "10000" } });
    expect(screen.getByText("disabled:false")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Record advance"));
    expect(onRecord).toHaveBeenCalledWith({ userId: "u1", amount: 10000, reason: null, recoveryPlan: "full_next", installmentAmount: null });
  });

  it("records with an installment plan", () => {
    render2(true);
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u2" } });
    fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("Recover from salary"), { target: { value: "installment" } });
    fireEvent.change(screen.getByLabelText(/Installment/), { target: { value: "2500" } });
    fireEvent.click(screen.getByText("Record advance"));
    expect(onRecord).toHaveBeenCalledWith({ userId: "u2", amount: 10000, reason: null, recoveryPlan: "installment", installmentAmount: 2500 });
  });

  it("resets its fields when reopened", () => {
    const { rerender } = render2(true);
    fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: "999" } });
    rerender(<RecordAdvanceDialog open={false} people={people} onOpenChange={onOpenChange} onRecord={onRecord} />);
    rerender(<RecordAdvanceDialog open people={people} onOpenChange={onOpenChange} onRecord={onRecord} />);
    expect((screen.getByLabelText("Amount (₹)") as HTMLInputElement).value).toBe("");
  });
});
