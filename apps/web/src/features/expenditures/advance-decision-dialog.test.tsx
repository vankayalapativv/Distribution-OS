import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Advance } from "./advances-api";

// Harness: confirm button always clickable (so we can exercise onConfirm in both
// valid + invalid states); confirmDisabled surfaced separately for assertions.
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: { title: string; description: React.ReactNode; confirmLabel: string; confirmDisabled: boolean; extra: React.ReactNode; onConfirm: () => void | Promise<void> }) => (
    <div>
      <h1>{p.title}</h1>
      <p>{p.description}</p>
      <span>disabled:{String(p.confirmDisabled)}</span>
      {p.extra}
      <button onClick={() => void p.onConfirm()}>{p.confirmLabel}</button>
    </div>
  ),
}));

import { AdvanceDecisionDialog, type AdvanceDecision } from "./advance-decision-dialog";

const advance = { id: "a1", userName: "Priya", amount: 10000, reason: "medical" } as Advance;
const onApprove = vi.fn(() => Promise.resolve());
const onReject = vi.fn(() => Promise.resolve());
const render2 = (d: AdvanceDecision | null) =>
  render(<AdvanceDecisionDialog decision={d} onOpenChange={vi.fn()} onApprove={onApprove} onReject={onReject} />);
afterEach(() => vi.clearAllMocks());

describe("AdvanceDecisionDialog", () => {
  it("renders nothing without a decision", () => {
    const { container } = render2(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("approves full-next by default", () => {
    render2({ advance, mode: "approve" });
    expect(screen.getByText("Approve advance")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("a1", { recoveryPlan: "full_next", installmentAmount: null });
  });

  it("approves with a valid installment and blocks an invalid one", () => {
    render2({ advance, mode: "approve" });
    fireEvent.change(screen.getByLabelText("Recover from salary"), { target: { value: "installment" } });
    fireEvent.change(screen.getByLabelText(/Installment/), { target: { value: "2000" } });
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("a1", { recoveryPlan: "installment", installmentAmount: 2000 });
    // Over the amount → invalid: disabled flagged, onConfirm is a no-op.
    onApprove.mockClear();
    fireEvent.change(screen.getByLabelText(/Installment/), { target: { value: "99999" } });
    expect(screen.getByText("disabled:true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("rejects with a reason, and flags a blank one", () => {
    render2({ advance, mode: "reject" });
    expect(screen.getByText("disabled:true")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  over limit  " } });
    fireEvent.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledWith("a1", "over limit");
  });

  it("falls back to 'Employee' and omits the reason when both are missing", () => {
    render2({ advance: { ...advance, userName: null, reason: null }, mode: "approve" });
    expect(screen.getByText(/Employee ·/)).toBeInTheDocument();
    expect(screen.queryByText(/medical/)).not.toBeInTheDocument();
  });

  it("resets when the target changes or closes", () => {
    const { rerender } = render2({ advance, mode: "approve" });
    fireEvent.change(screen.getByLabelText("Recover from salary"), { target: { value: "installment" } });
    rerender(<AdvanceDecisionDialog decision={null} onOpenChange={vi.fn()} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByText("Approve advance")).not.toBeInTheDocument();
  });
});
