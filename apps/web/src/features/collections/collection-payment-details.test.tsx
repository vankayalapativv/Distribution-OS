import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionPaymentDetails } from "./collection-payment-details";
import { collectionDetail } from "./collection-detail-fixture";

describe("CollectionPaymentDetails", () => {
  it("renders nothing when there are no reference/cheque/bank fields", () => {
    const { container } = render(<CollectionPaymentDetails collection={collectionDetail()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows reference, cheque date, bank and cheque status when present", () => {
    render(
      <CollectionPaymentDetails
        collection={collectionDetail({
          paymentReferenceNumber: "UTR55", chequeDate: "2026-09-10", bankName: "SBI", chequeStatus: "cleared",
        })}
      />,
    );
    expect(screen.getByText("UTR55")).toBeInTheDocument();
    expect(screen.getByText("Cheque Date")).toBeInTheDocument();
    expect(screen.getByText("SBI")).toBeInTheDocument();
    expect(screen.getByText("cleared")).toBeInTheDocument();
  });
});
