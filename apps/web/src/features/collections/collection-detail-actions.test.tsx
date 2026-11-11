import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionDetailActions } from "./collection-detail-actions";

const base = {
  status: "pending", canReview: true, isPending: true, isVerifying: false,
  onVerify: vi.fn(), onReject: vi.fn(),
};

describe("CollectionDetailActions", () => {
  it("shows Verify + Reject for a reviewer on a pending collection", () => {
    const onVerify = vi.fn();
    const onReject = vi.fn();
    render(<CollectionDetailActions {...base} onVerify={onVerify} onReject={onReject} />);
    fireEvent.click(screen.getByText("Verify"));
    fireEvent.click(screen.getByText("Reject"));
    expect(onVerify).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
  });

  it("hides the actions for a non-reviewer", () => {
    render(<CollectionDetailActions {...base} canReview={false} />);
    expect(screen.queryByText("Verify")).not.toBeInTheDocument();
  });

  it("hides the actions once the collection is not pending", () => {
    render(<CollectionDetailActions {...base} isPending={false} status="verified" />);
    expect(screen.queryByText("Verify")).not.toBeInTheDocument();
  });

  it("shows a verifying label while in progress", () => {
    render(<CollectionDetailActions {...base} isVerifying />);
    expect(screen.getByText("Verifying…")).toBeInTheDocument();
  });
});
