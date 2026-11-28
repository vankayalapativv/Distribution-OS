import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Thin ConfirmDialog harness: renders title + extra + a confirm button that honours
// confirmDisabled and runs onConfirm, so we test THIS component's logic/validation.
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: (p: {
    open: boolean; title: string; confirmLabel: string; confirmDisabled: boolean;
    extra: React.ReactNode; onConfirm: () => void | Promise<void>; onOpenChange: (o: boolean) => void;
  }) => p.open ? (
    <div>
      <h1>{p.title}</h1>
      {p.extra}
      <button disabled={p.confirmDisabled} onClick={() => void p.onConfirm()}>{p.confirmLabel}</button>
    </div>
  ) : null,
}));

import { ClaimDecisionDialog, type ClaimDecision } from "./claim-decision-dialog";

const claim = { id: "c1", claimedAmount: 450, categoryName: "Fuel" } as ClaimDecision["claim"];
const onApprove = vi.fn(() => Promise.resolve());
const onReject = vi.fn(() => Promise.resolve());
const onOpenChange = vi.fn();
const render2 = (decision: ClaimDecision | null) =>
  render(<ClaimDecisionDialog decision={decision} onOpenChange={onOpenChange} onApprove={onApprove} onReject={onReject} />);

afterEach(() => vi.clearAllMocks());

describe("ClaimDecisionDialog", () => {
  it("renders nothing when there's no decision", () => {
    const { container } = render2(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("approves at the claimed amount + default mode, a reduced amount and a chosen mode when changed", () => {
    render2({ claim, mode: "approve" });
    expect(screen.getByText("Approve & reimburse")).toBeInTheDocument();
    const input = screen.getByLabelText(/Approved amount/) as HTMLInputElement;
    expect(input.value).toBe("450");
    fireEvent.click(screen.getByText("Approve & pay"));
    expect(onApprove).toHaveBeenLastCalledWith("c1", 450, "cash"); // defaults
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Reimburse via"), { target: { value: "upi" } });
    fireEvent.click(screen.getByText("Approve & pay"));
    expect(onApprove).toHaveBeenLastCalledWith("c1", 300, "upi");
  });

  it("disables Approve for an amount of 0 or above the claimed amount", () => {
    render2({ claim, mode: "approve" });
    const input = screen.getByLabelText(/Approved amount/);
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText("Approve & pay")).toBeDisabled();
    fireEvent.change(input, { target: { value: "600" } });
    expect(screen.getByText("Approve & pay")).toBeDisabled();
  });

  it("rejects with a trimmed reason, and blocks a blank one", () => {
    render2({ claim, mode: "reject" });
    expect(screen.getByText("Reject claim")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "  blurry bill  " } });
    fireEvent.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledWith("c1", "blurry bill");
  });

  it("resets the amount when the target claim changes or closes", () => {
    const { rerender } = render2({ claim, mode: "approve" });
    fireEvent.change(screen.getByLabelText(/Approved amount/), { target: { value: "100" } });
    const other = { ...claim, id: "c2", claimedAmount: 999 };
    rerender(<ClaimDecisionDialog decision={{ claim: other, mode: "approve" }} onOpenChange={onOpenChange} onApprove={onApprove} onReject={onReject} />);
    expect((screen.getByLabelText(/Approved amount/) as HTMLInputElement).value).toBe("999");
    // Closing (decision → null) clears the fields and renders nothing.
    rerender(<ClaimDecisionDialog decision={null} onOpenChange={onOpenChange} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByText("Approve & reimburse")).not.toBeInTheDocument();
  });
});
