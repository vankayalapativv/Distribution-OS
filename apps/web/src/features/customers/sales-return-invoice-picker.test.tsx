import { fireEvent, render, screen } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/format", () => ({ rupeesExact: (n: number) => `₹${n}` }));
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: (p: {
    placeholder: string;
    items: { id: string }[];
    getKey: (i: { id: string }) => string;
    getLabel: (i: { invoiceNumber: string; outstandingAmount: number }) => string;
    onSelect: (id: string) => void;
  }) => (
    <select aria-label="invoice" data-ph={p.placeholder} onChange={(e) => p.onSelect(e.target.value)}>
      {p.items.map((i) => (
        <option key={p.getKey(i)} value={p.getKey(i)}>
          {p.getLabel(i as never)}
        </option>
      ))}
    </select>
  ),
}));

import { SalesReturnInvoicePicker } from "./sales-return-invoice-picker";
import type { OutstandingInvoice } from "./sales-return-create-logic";

const q = (over: Partial<UseQueryResult<{ invoices: OutstandingInvoice[] }>> = {}) =>
  ({ data: { invoices: [{ id: "inv1", invoiceNumber: "INV-1", invoiceDate: "d", outstandingAmount: 500 }] }, isLoading: false, ...over }) as UseQueryResult<{ invoices: OutstandingInvoice[] }>;

describe("SalesReturnInvoicePicker", () => {
  it("lists invoices (labeled with dues), picks one, and edits the date", () => {
    const pickInvoice = vi.fn();
    const setDate = vi.fn();
    render(<SalesReturnInvoicePicker invoiceId="" pickInvoice={pickInvoice} invoicesQ={q()} date="2026-07-01" setDate={setDate} />);

    expect(screen.getByRole("option", { name: "INV-1 · ₹500 due" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("invoice"), { target: { value: "inv1" } });
    expect(pickInvoice).toHaveBeenCalledWith("inv1");
    fireEvent.change(screen.getByDisplayValue("2026-07-01"), { target: { value: "2026-08-01" } });
    expect(setDate).toHaveBeenCalledWith("2026-08-01");
  });

  it("shows a loading placeholder", () => {
    render(<SalesReturnInvoicePicker invoiceId="" pickInvoice={vi.fn()} invoicesQ={q({ isLoading: true, data: undefined })} date="d" setDate={vi.fn()} />);
    expect(screen.getByLabelText("invoice")).toHaveAttribute("data-ph", "Loading invoices…");
  });

  it("shows the no-invoices placeholder when the list is empty", () => {
    render(<SalesReturnInvoicePicker invoiceId="" pickInvoice={vi.fn()} invoicesQ={q({ data: { invoices: [] } })} date="d" setDate={vi.fn()} />);
    expect(screen.getByLabelText("invoice")).toHaveAttribute("data-ph", "No outstanding invoices");
  });
});
