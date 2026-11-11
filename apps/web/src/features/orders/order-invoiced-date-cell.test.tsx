import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvoicedDateCell } from "./order-invoiced-date-cell";
import type { OrderInvoiceRef } from "./orders-api";

const iv = (id: string, number: string, date: string | null): OrderInvoiceRef =>
  ({ id, number, date }) as OrderInvoiceRef;

describe("InvoicedDateCell", () => {
  it("shows an em dash when no invoice has a date", () => {
    render(<InvoicedDateCell invoices={[iv("i1", "INV-1", null)]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows just the earliest date for a single dated invoice", () => {
    render(<InvoicedDateCell invoices={[iv("i1", "INV-1", "2026-03-01")]} />);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    expect(screen.getByText(/2026|Mar|01|1/)).toBeInTheDocument();
  });

  it("shows +N more and opens a per-invoice panel on hover", () => {
    render(
      <InvoicedDateCell invoices={[iv("i1", "INV-1", "2026-03-01"), iv("i2", "INV-2", "2026-03-05")]} />,
    );
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    const trigger = screen.getByText("+1 more").parentElement!;
    fireEvent.mouseEnter(trigger); // opens
    expect(screen.getByText("2 invoices")).toBeInTheDocument();
    expect(screen.getByText("INV-2")).toBeInTheDocument();
    const content = screen.getByText("2 invoices").parentElement!;
    fireEvent.mouseEnter(content); // keep open (content hover)
    fireEvent.click(content); // swallowed
    fireEvent.mouseLeave(content); // closes
    fireEvent.click(trigger); // swallowed
    fireEvent.mouseLeave(trigger); // closes
  });

  it("tolerates a missing invoices field", () => {
    render(<InvoicedDateCell invoices={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
