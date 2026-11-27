import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseClaim } from "./expense-claims-api";

const canApprove = { value: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: () => canApprove.value }));
const queue = {
  claims: [] as ExpenseClaim[],
  isLoading: false,
  approve: vi.fn(() => Promise.resolve()),
  reject: vi.fn(() => Promise.resolve()),
};
vi.mock("./use-claims-queue", () => ({ useClaimsQueue: () => queue }));
vi.mock("./claim-decision-dialog", () => ({
  ClaimDecisionDialog: ({ decision, onOpenChange, onApprove, onReject }: {
    decision: { mode: string; claim: { id: string } } | null;
    onOpenChange: (o: boolean) => void;
    onApprove: (id: string, a: number) => Promise<void>;
    onReject: (id: string, r: string) => Promise<void>;
  }) => decision ? (
    <div>
      DECISION:{decision.mode}:{decision.claim.id}
      <button onClick={() => onOpenChange(false)}>close-decision</button>
      <button onClick={() => void onApprove(decision.claim.id, 1)}>do-approve</button>
      <button onClick={() => void onReject(decision.claim.id, "r")}>do-reject</button>
    </div>
  ) : null,
}));
vi.mock("./claim-receipt-dialog", () => ({
  ClaimReceiptDialog: ({ claim, onClose }: { claim: { id: string } | null; onClose: () => void }) =>
    claim ? <div>RECEIPT:{claim.id}<button onClick={onClose}>close-receipt</button></div> : null,
}));

import { ClaimsQueuePanel } from "./claims-queue-panel";

const claim = (over: Partial<ExpenseClaim> = {}): ExpenseClaim => ({
  id: "c1", code: "EXP-7", date: "2026-11-28", categoryId: "x", categoryName: "Fuel",
  amount: 450, claimedAmount: 450, status: "submitted", remarks: null, rejectReason: null,
  hasReceipt: true, submittedBy: "se1", submitterName: "Priya", approvedAt: null, createdAt: "2026-11-28", ...over,
});
const config = { apiBaseUrl: "", authToken: "" };
const renderPanel = () => render(<ClaimsQueuePanel actionConfig={config} />);

beforeEach(() => {
  vi.clearAllMocks();
  canApprove.value = true; queue.isLoading = false;
  queue.claims = [claim({ remarks: "toll" }), claim({ id: "c2", categoryName: "Food", hasReceipt: false, submitterName: null })];
  queue.approve.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("ClaimsQueuePanel", () => {
  it("hides when the user cannot approve", () => {
    canApprove.value = false;
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("hides while loading and when there's nothing pending", () => {
    queue.isLoading = true;
    const { container, rerender } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    queue.isLoading = false; queue.claims = [];
    rerender(<ClaimsQueuePanel actionConfig={config} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists pending claims with a receipt button only when attached", () => {
    renderPanel();
    expect(screen.getByText("Pending claims (2)")).toBeInTheDocument();
    expect(screen.getByText(/Fuel · ₹450/)).toBeInTheDocument();
    expect(screen.getByText(/Priya · .* · toll/)).toBeInTheDocument();
    expect(screen.getAllByText("Receipt")).toHaveLength(1); // only c1 has a receipt
  });

  it("approves in full and surfaces an error if it fails", async () => {
    queue.approve.mockRejectedValueOnce(new Error("offline"));
    renderPanel();
    fireEvent.click(screen.getAllByText("Approve")[0]);
    await waitFor(() => expect(screen.getByText("offline")).toBeInTheDocument());
    expect(queue.approve).toHaveBeenCalledWith("c1", null);
  });

  it("uses a generic message for a non-Error approve failure", async () => {
    queue.approve.mockRejectedValueOnce("boom");
    renderPanel();
    fireEvent.click(screen.getAllByText("Approve")[0]);
    await waitFor(() => expect(screen.getByText("Could not approve the claim.")).toBeInTheDocument());
  });

  it("opens the reduce and reject dialogs", () => {
    renderPanel();
    fireEvent.click(screen.getAllByText("Reduce")[0]);
    expect(screen.getByText("DECISION:reduce:c1")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Reject")[1]);
    expect(screen.getByText("DECISION:reject:c2")).toBeInTheDocument();
  });

  it("opens and closes the receipt viewer", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Receipt"));
    expect(screen.getByText("RECEIPT:c1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close-receipt"));
    expect(screen.queryByText("RECEIPT:c1")).not.toBeInTheDocument();
  });

  it("wires the decision dialog to approve/reject and close", async () => {
    renderPanel();
    fireEvent.click(screen.getAllByText("Reduce")[0]);
    fireEvent.click(screen.getByText("do-approve"));
    expect(queue.approve).toHaveBeenCalledWith("c1", 1);
    fireEvent.click(screen.getByText("do-reject"));
    expect(queue.reject).toHaveBeenCalledWith("c1", "r");
    fireEvent.click(screen.getByText("close-decision"));
    expect(screen.queryByText(/^DECISION/)).not.toBeInTheDocument();
  });
});
