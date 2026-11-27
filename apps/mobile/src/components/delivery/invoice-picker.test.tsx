import { describe, expect, it, vi } from "vitest";

const openInMaps = vi.fn();
vi.mock("../../lib/deliverable-invoice", () => ({
  addressLine: (inv: { address?: string }) => inv.address ?? "",
  openInMaps: (...a: unknown[]) => openInMaps(...a),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { InvoicePicker } from "./invoice-picker";

const inv = (over: Record<string, unknown> = {}) =>
  ({ id: "i1", invoiceNumber: "INV-1", customerName: "Acme", customerCode: "C1", address: "MG Road", ...over }) as never;

const base = {
  isPending: false,
  isError: false,
  filtered: [inv()],
  search: "",
  placeholder: "#999",
  onSearch: vi.fn(),
  onPick: vi.fn(),
  onBack: vi.fn(),
  refreshing: false,
  onRefresh: () => {},
};

describe("InvoicePicker", () => {
  it("lists invoices, searches, picks one, and opens the map", () => {
    const onPick = vi.fn();
    const onSearch = vi.fn();
    const onBack = vi.fn();
    render(<InvoicePicker {...base} onPick={onPick} onSearch={onSearch} onBack={onBack} />);
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    expect(screen.getByText("MG Road")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search invoice/), { target: { value: "ac" } });
    expect(onSearch).toHaveBeenCalledWith("ac");
    fireEvent.click(screen.getByLabelText("Open location in Google Maps"));
    expect(openInMaps).toHaveBeenCalled();
    fireEvent.click(screen.getByText("INV-1")); // pick the invoice
    expect(onPick).toHaveBeenCalled();
    fireEvent.click(screen.getByText("‹"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the pending skeleton and the error state", () => {
    const onRetry = vi.fn();
    const { rerender, container } = render(<InvoicePicker {...base} isPending />);
    expect(container.querySelector("div")).not.toBeNull();
    rerender(<InvoicePicker {...base} isError error={new Error("down")} onRetry={onRetry} />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows the search-empty vs no-invoices messages", () => {
    const { rerender } = render(<InvoicePicker {...base} filtered={[]} search="zzz" />);
    expect(screen.getByText(/No invoices match/)).toBeInTheDocument();
    rerender(<InvoicePicker {...base} filtered={[]} search="" />);
    expect(screen.getByText(/no invoices to deliver/)).toBeInTheDocument();
  });

  it("falls back for a missing customer name / code / address", () => {
    render(<InvoicePicker {...base} filtered={[inv({ customerName: null, customerCode: null, address: "" })]} />);
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });
});
