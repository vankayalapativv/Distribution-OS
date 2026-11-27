import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExpenseClaim } from "./expense-claims-api";

const blob = { src: null as string | null, isPdf: false, failed: false };
vi.mock("./use-bill-blob", () => ({ useBillBlob: () => blob }));

import { ClaimReceiptDialog } from "./claim-receipt-dialog";

const claim = { id: "c1", code: "EXP-7", categoryName: "Fuel", submitterName: "Priya" } as ExpenseClaim;
const base = { onClose: vi.fn(), actionConfig: { apiBaseUrl: "", authToken: "" } };
afterEach(() => { blob.src = null; blob.isPdf = false; blob.failed = false; vi.clearAllMocks(); });

describe("ClaimReceiptDialog", () => {
  it("renders nothing without a claim", () => {
    render(<ClaimReceiptDialog {...base} claim={null} />);
    expect(screen.queryByText(/Receipt/)).not.toBeInTheDocument();
  });

  it("titles with the category + submitter and shows a loader then the image", () => {
    const { rerender } = render(<ClaimReceiptDialog {...base} claim={claim} />);
    expect(screen.getByText("Receipt · Fuel")).toBeInTheDocument();
    expect(screen.getByText(/submitted by Priya/)).toBeInTheDocument();
    blob.src = "blob:x";
    rerender(<ClaimReceiptDialog {...base} claim={claim} />);
    expect(screen.getByRole("img", { name: "Receipt" })).toBeInTheDocument();
  });

  it("shows a PDF in an iframe", () => {
    blob.src = "blob:x"; blob.isPdf = true;
    render(<ClaimReceiptDialog {...base} claim={claim} />);
    expect(screen.getByTitle("Receipt")).toBeInTheDocument();
  });

  it("shows the failed message", () => {
    blob.failed = true;
    render(<ClaimReceiptDialog {...base} claim={claim} />);
    expect(screen.getByText(/Couldn't load the receipt/)).toBeInTheDocument();
  });

  it("falls back to a dash when the submitter is unknown", () => {
    render(<ClaimReceiptDialog {...base} claim={{ ...claim, submitterName: null }} />);
    expect(screen.getByText(/submitted by —/)).toBeInTheDocument();
  });

  it("closes on dismiss", () => {
    const onClose = vi.fn();
    render(<ClaimReceiptDialog {...base} onClose={onClose} claim={claim} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
