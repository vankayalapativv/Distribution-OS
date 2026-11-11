import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { collectionDetail } from "./collection-detail-fixture";

const hook = {
  collection: collectionDetail(), setCollection: vi.fn(), isVerifying: false,
  verifyError: null as string | null, rejectOpen: false, setRejectOpen: vi.fn(),
  handleVerify: vi.fn(), isPending: true,
};
vi.mock("./use-collection-detail", () => ({ useCollectionDetail: () => hook }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./collection-summary", () => ({ CollectionSummary: () => <div data-testid="summary" /> }));
vi.mock("./collection-allocations", () => ({ CollectionAllocations: () => <div data-testid="allocations" /> }));
vi.mock("./collection-receipt", () => ({ CollectionReceipt: () => <div data-testid="receipt" /> }));
vi.mock("./collection-reject-dialog", () => ({
  CollectionRejectDialog: ({ open }: { readonly open: boolean }) => (open ? <div data-testid="reject-open" /> : null),
}));
vi.mock("./collection-detail-actions", () => ({
  CollectionDetailActions: ({ onVerify, onReject }: { readonly onVerify: () => void; readonly onReject: () => void }) => (
    <div><button onClick={onVerify}>do-verify</button><button onClick={onReject}>do-reject</button></div>
  ),
}));

import { CollectionDetailView } from "./collections-detail";

const config = { apiBaseUrl: "", authToken: "" };

describe("CollectionDetailView", () => {
  it("renders the code, customer link and the summary/allocations", () => {
    render(<CollectionDetailView collection={collectionDetail()} role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getAllByText("COL-0001").length).toBeGreaterThan(0);
    expect(screen.getByText("Sri Laxmi")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toBeInTheDocument();
    expect(screen.getByTestId("allocations")).toBeInTheDocument();
  });

  it("shows the receipt only for a reviewer when a proof exists", () => {
    hook.collection = collectionDetail({ proof: { id: "p1", contentType: "image/jpeg", createdAt: "x" } });
    render(<CollectionDetailView collection={hook.collection} role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByTestId("receipt")).toBeInTheDocument();
    hook.collection = collectionDetail();
  });

  it("wires verify and reject actions", () => {
    render(<CollectionDetailView collection={collectionDetail()} role="ACCOUNTANT" actionConfig={config} />);
    fireEvent.click(screen.getByText("do-verify"));
    fireEvent.click(screen.getByText("do-reject"));
    expect(hook.handleVerify).toHaveBeenCalled();
    expect(hook.setRejectOpen).toHaveBeenCalledWith(true);
  });

  it("shows a verify error when present", () => {
    hook.verifyError = "Failed to verify.";
    render(<CollectionDetailView collection={collectionDetail()} role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByText("Failed to verify.")).toBeInTheDocument();
    hook.verifyError = null;
  });
});
