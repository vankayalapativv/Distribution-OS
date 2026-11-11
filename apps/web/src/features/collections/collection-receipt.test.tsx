import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const blob = { src: "blob:x", failed: false };
vi.mock("./use-proof-blob", () => ({ useProofBlob: () => blob }));
vi.mock("./collection-receipt-thumb", () => ({
  CollectionReceiptThumb: ({ onEnlarge }: { readonly onEnlarge: () => void }) => <button onClick={onEnlarge}>thumb</button>,
}));

import { CollectionReceipt } from "./collection-receipt";

const config = { apiBaseUrl: "", authToken: "" };
const proof = { id: "p1", contentType: "image/jpeg", createdAt: "2026-07-24T10:43:00Z" };

describe("CollectionReceipt", () => {
  it("shows the receipt header with the upload caption", () => {
    render(<CollectionReceipt collectionId="c1" proof={proof} actionConfig={config} />);
    expect(screen.getByText("Payment receipt")).toBeInTheDocument();
    expect(screen.getByText(/Uploaded by the sales executive/)).toBeInTheDocument();
  });

  it("opens the enlarge dialog from the thumbnail", () => {
    render(<CollectionReceipt collectionId="c1" proof={proof} actionConfig={config} />);
    expect(screen.queryByAltText("Payment receipt")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("thumb"));
    expect(screen.getByAltText("Payment receipt")).toBeInTheDocument(); // dialog image
  });
});
