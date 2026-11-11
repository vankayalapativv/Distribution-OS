import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildInvoiceColumns, invoiceColumns, invoiceSkeleton } from "./invoices-columns";
import type { InvoiceRow } from "./invoices-api";

const row = (over: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: "i1", invoiceNumber: "BAL/1", invoiceDate: "2026-07-18", customerId: "c1",
  customerName: "Acme", customerCity: "Pune", orderId: "o1", orderCode: "ORD-9",
  salesExecutiveId: null, salesExecutiveName: "Asha", station: null, partyPhone: null,
  totalLitres: 12, taxableValue: 1000, gstAmount: 180, grandTotal: 1180,
  amountCollected: 0, outstandingAmount: 500, paymentStatus: "partial", createdAt: "",
  ...over,
});
type CellFn = (ctx: { row: { original: InvoiceRow }; getValue: () => unknown }) => React.ReactNode;
const byKey = (k: string) => invoiceColumns.find((c) => (c as { accessorKey?: string }).accessorKey === k)!;
const renderCell = (k: string, r: InvoiceRow) => {
  const { cell } = byKey(k) as { cell: CellFn; accessorKey: keyof InvoiceRow };
  return render(<>{cell({ row: { original: r }, getValue: () => r[k as keyof InvoiceRow] })}</>);
};

describe("invoiceColumns", () => {
  it("has eight columns (incl. actions) and a matching skeleton", () => {
    expect(invoiceColumns).toHaveLength(8);
    expect(invoiceSkeleton).toHaveLength(8);
  });

  it("offers Download on every row, plus Edit + Cancel only on editable invoices", () => {
    const onCancel = vi.fn();
    const onDownload = vi.fn();
    const actions = buildInvoiceColumns({ onCancel, onDownload }).find((c) => (c as { id?: string }).id === "actions")! as unknown as { cell: CellFn };
    const renderActions = (r: InvoiceRow) => render(<>{actions.cell({ row: { original: r }, getValue: () => undefined })}</>);

    // Editable → Download + Edit (link) + Cancel.
    const { unmount } = renderActions(row({ invoiceSource: "generated", docStatus: "final", paymentStatus: "unpaid" }));
    fireEvent.click(screen.getByTitle("Actions"));
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit/ })).toHaveAttribute("href", "/invoices/i1/edit");
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalled();
    unmount();

    // Paid / cancelled → kebab shows, but only Download (no Edit / Cancel).
    const { unmount: u2 } = renderActions(row({ invoiceSource: "generated", docStatus: "cancelled", paymentStatus: "unpaid" }));
    fireEvent.click(screen.getByTitle("Actions"));
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    expect(onDownload).toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Cancel$/ })).toBeNull();
    u2();

    // With no onDownload wired (and non-editable) there is nothing to show.
    const bare = buildInvoiceColumns().find((c) => (c as { id?: string }).id === "actions")! as unknown as { cell: CellFn };
    render(<>{bare.cell({ row: { original: row({ invoiceSource: "generated", docStatus: "cancelled", paymentStatus: "unpaid" }) }, getValue: () => undefined })}</>);
    expect(screen.queryByTitle("Actions")).toBeNull();
  });

  it("links the order when present, dashes it otherwise", () => {
    const { unmount } = renderCell("orderCode", row());
    expect(screen.getByRole("link", { name: "ORD-9" })).toHaveAttribute("href", "/orders/o1");
    unmount();
    renderCell("orderCode", row({ orderId: null, orderCode: null }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows oil litres and the money columns", () => {
    const { unmount } = renderCell("totalLitres", row());
    expect(screen.getByText(/12/)).toBeInTheDocument();
    unmount();
    renderCell("grandTotal", row());
    expect(screen.getByText(/1,180|1180/)).toBeInTheDocument();
  });

  it("renders the number, customer, before-GST and outstanding cells", () => {
    renderCell("invoiceNumber", row());
    expect(screen.getByText("BAL/1")).toBeInTheDocument();
    renderCell("customerName", row());
    expect(screen.getByText("Acme")).toBeInTheDocument();
    renderCell("taxableValue", row());
    expect(screen.getByText(/1,000|1000/)).toBeInTheDocument();
    renderCell("outstandingAmount", row());
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("renders every skeleton cell", () => {
    expect(invoiceSkeleton.length).toBeGreaterThan(0);
    invoiceSkeleton.forEach((c) => render(<>{c()}</>));
  });
});
