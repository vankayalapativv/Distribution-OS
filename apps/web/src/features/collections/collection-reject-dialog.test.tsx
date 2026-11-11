import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { collectionDetail } from "./collection-detail-fixture";

const hook = {
  remark: "", setRemark: vi.fn(), isRejecting: false, rejectError: null as string | null,
  setRejectError: vi.fn(), handleReject: vi.fn(),
};
vi.mock("./use-collection-reject", () => ({ useCollectionReject: () => hook }));

import { CollectionRejectDialog } from "./collection-reject-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const props = { open: true, onOpenChange: vi.fn(), collection: collectionDetail(), actionConfig: config, onRejected: vi.fn() };

describe("CollectionRejectDialog", () => {
  it("names the collection being rejected", () => {
    render(<CollectionRejectDialog {...props} />);
    expect(screen.getByText("COL-0001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reject collection" })).toBeInTheDocument();
  });

  it("disables the reject button while the reason is blank", () => {
    hook.remark = "";
    render(<CollectionRejectDialog {...props} />);
    expect(screen.getByRole("button", { name: "Reject collection" })).toBeDisabled();
  });

  it("enables and fires reject once a reason is typed", () => {
    hook.remark = "cheque bounced";
    render(<CollectionRejectDialog {...props} />);
    const btn = screen.getByRole("button", { name: "Reject collection" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(hook.handleReject).toHaveBeenCalled();
    hook.remark = "";
  });

  it("cancels and clears the error", () => {
    const onOpenChange = vi.fn();
    render(<CollectionRejectDialog {...props} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(hook.setRejectError).toHaveBeenCalledWith(null);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a rejection error", () => {
    hook.rejectError = "Failed to reject.";
    render(<CollectionRejectDialog {...props} />);
    expect(screen.getByText(/Failed to reject/)).toBeInTheDocument();
    hook.rejectError = null;
  });
});
