import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionSummary } from "./collection-summary";
import { collectionDetail } from "./collection-detail-fixture";

describe("CollectionSummary", () => {
  it("shows the amount, mapped payment mode and collector", () => {
    render(<CollectionSummary collection={collectionDetail({ paymentMode: "neft_rtgs" })} />);
    expect(screen.getByText("Payment Mode")).toBeInTheDocument();
    expect(screen.getByText("NEFT/RTGS")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
  });

  it("shows a green verified banner", () => {
    render(<CollectionSummary collection={collectionDetail({ accountantApprovalStatus: "verified", approvedByAccountantName: "Anil", approvedAt: "2026-09-15T00:00:00Z" })} />);
    expect(screen.getByText(/Verified by Anil/)).toBeInTheDocument();
  });

  it("shows a rejection reason and suppresses the remarks card", () => {
    render(<CollectionSummary collection={collectionDetail({ accountantApprovalStatus: "rejected", remarks: "blurry photo", approvedByAccountantName: "Anil", approvedAt: "2026-09-15T00:00:00Z" })} />);
    expect(screen.getByText(/Reason: blurry photo/)).toBeInTheDocument();
    expect(screen.queryByText("Remarks")).not.toBeInTheDocument();
  });

  it("shows the remarks card for a non-rejected collection with remarks", () => {
    render(<CollectionSummary collection={collectionDetail({ remarks: "paid in cash" })} />);
    expect(screen.getByText("Remarks")).toBeInTheDocument();
    expect(screen.getByText("paid in cash")).toBeInTheDocument();
  });
});
