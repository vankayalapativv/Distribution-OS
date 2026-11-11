import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionAllocations } from "./collection-allocations";

describe("CollectionAllocations", () => {
  it("shows an empty message when there are no allocations", () => {
    render(<CollectionAllocations allocations={[]} />);
    expect(screen.getByText(/No invoices allocated/)).toBeInTheDocument();
  });

  it("lists each allocation's invoice number and amount", () => {
    render(
      <CollectionAllocations
        allocations={[
          { id: "a1", collectionId: "c1", invoiceId: "i1", invoiceNumber: "INV-1", allocatedAmount: "1500" },
          { id: "a2", collectionId: "c1", invoiceId: "i2", invoiceNumber: "INV-2", allocatedAmount: "500" },
        ]}
      />,
    );
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    expect(screen.getByText("INV-2")).toBeInTheDocument();
    expect(screen.queryByText(/No invoices allocated/)).not.toBeInTheDocument();
  });
});
