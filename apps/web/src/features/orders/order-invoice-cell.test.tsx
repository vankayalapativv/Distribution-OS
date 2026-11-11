import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openInvoicePdf = vi.fn();
vi.mock("@/features/invoices/invoices-api", () => ({ openInvoicePdf: (...a: unknown[]) => openInvoicePdf(...a) }));

import { InvoiceCell, invoiceColumn, invoiceSkeletonCell } from "./order-invoice-cell";
import type { OrderInvoiceRef } from "./orders-api";

const iv = (id: string, number: string): OrderInvoiceRef => ({ id, number }) as OrderInvoiceRef;

afterEach(() => openInvoicePdf.mockReset());

describe("InvoiceCell", () => {
  it("shows an em dash when nothing is billed", () => {
    render(<InvoiceCell invoices={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("a single invoice is a direct link that opens the PDF", () => {
    render(<InvoiceCell invoices={[iv("i1", "INV-1")]} />);
    fireEvent.click(screen.getByRole("button", { name: "INV-1" }));
    expect(openInvoicePdf).toHaveBeenCalledWith("i1", "INV-1");
  });

  it("several invoices show first + count and open a pick menu", () => {
    render(<InvoiceCell invoices={[iv("i1", "INV-1"), iv("i2", "INV-2")]} />);
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Open an invoice"));
    // A click on the menu surface (not an item) is swallowed — opens nothing.
    fireEvent.click(screen.getByText("2 invoices").parentElement!);
    expect(openInvoicePdf).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "INV-2" }));
    expect(openInvoicePdf).toHaveBeenCalledWith("i2", "INV-2");
  });

  it("tolerates a missing invoices field", () => {
    render(<InvoiceCell invoices={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("invoiceColumn / invoiceSkeletonCell", () => {
  it("column cell renders the InvoiceCell for a row", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<>{(invoiceColumn.cell as any)({ row: { original: { invoices: [iv("i1", "INV-9")] } } })}</>);
    expect(screen.getByRole("button", { name: "INV-9" })).toBeInTheDocument();
  });

  it("skeleton cell renders a placeholder", () => {
    const { container } = render(<>{invoiceSkeletonCell()}</>);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });
});
