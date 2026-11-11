import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InvoicesListState } from "./use-invoices-list";

import { InvoicesSearchBar } from "./invoices-search-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (over: any): InvoicesListState => ({
  qInput: "", setQInput: vi.fn(), applied: "", applySearch: vi.fn(), clearSearch: vi.fn(),
  customerId: "", customerName: null, clearCustomer: vi.fn(),
  ...over,
}) as InvoicesListState;

describe("InvoicesSearchBar", () => {
  it("types + submits to apply the search", () => {
    const s = state({});
    render(<InvoicesSearchBar s={s} />);
    fireEvent.change(screen.getByPlaceholderText(/Search invoice/), { target: { value: "BAL" } });
    expect(s.setQInput).toHaveBeenCalledWith("BAL");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(s.applySearch).toHaveBeenCalled();
  });

  it("shows Clear only when a search is applied", () => {
    const s = state({ applied: "BAL" });
    render(<InvoicesSearchBar s={s} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(s.clearSearch).toHaveBeenCalled();
  });

  it("shows a customer chip that clears the customer filter", () => {
    const s = state({ customerId: "c1", customerName: "Acme" });
    render(<InvoicesSearchBar s={s} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Acme"));
    expect(s.clearCustomer).toHaveBeenCalled();
  });

  it("falls back to 'selected' when the customer name is unknown", () => {
    render(<InvoicesSearchBar s={state({ customerId: "c1", customerName: null })} />);
    expect(screen.getByText("selected")).toBeInTheDocument();
  });
});
