import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvoiceCustomerCell, InvoiceNumberCell, InvoiceOutstandingCell } from "./invoice-cells";
import type { InvoiceRow } from "./invoices-api";

const row = (over: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: "i1", invoiceNumber: "BAL/1", invoiceDate: "2026-07-18", customerId: "c1",
  customerName: "Acme", customerCity: "Pune", orderId: null, orderCode: null,
  salesExecutiveId: null, salesExecutiveName: "Asha", station: null, partyPhone: null,
  totalLitres: 0, taxableValue: 0, gstAmount: 0, grandTotal: 0,
  amountCollected: 0, outstandingAmount: 500, paymentStatus: "partial", createdAt: "",
  ...over,
});

describe("invoice cells", () => {
  it("number cell shows the invoice no + formatted date", () => {
    render(<InvoiceNumberCell row={row()} />);
    expect(screen.getByText("BAL/1")).toBeInTheDocument();
    expect(screen.getByText(/2026|Jul/)).toBeInTheDocument();
  });

  it("customer cell shows name, SE and city — with fallbacks", () => {
    const { rerender } = render(<InvoiceCustomerCell row={row()} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Asha · Pune")).toBeInTheDocument();
    rerender(<InvoiceCustomerCell row={row({ customerName: null, salesExecutiveName: null, customerCity: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("No SE")).toBeInTheDocument();
  });

  it("outstanding cell shows the amount and a status badge", () => {
    render(<InvoiceOutstandingCell row={row()} rupeesExact={(n) => `₹${n}`} />);
    expect(screen.getByText("₹500")).toBeInTheDocument();
    expect(screen.getByText("partial")).toBeInTheDocument();
  });
});
