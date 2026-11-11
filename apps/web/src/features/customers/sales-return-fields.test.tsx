import { render, screen } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({ errorMessage: (_e: unknown, f: string) => f }));
vi.mock("@/lib/format", () => ({ rupeesExact: (n: number) => `₹${n}` }));
vi.mock("./sales-return-invoice-picker", () => ({ SalesReturnInvoicePicker: () => <div>picker</div> }));
vi.mock("./sales-return-lines", () => ({ SalesReturnLines: () => <div>lines-table</div> }));
vi.mock("./sales-return-reason-proof", () => ({ SalesReturnReasonProof: () => <div>reason-proof</div> }));

import { SalesReturnFields } from "./sales-return-fields";
import type { ReturnLine } from "./sales-return-edit-logic";
import type { ReturnableResponse } from "./sales-return-create-logic";

const line = { orderItemId: "a" } as unknown as ReturnLine;
const rq = (over: Partial<UseQueryResult<ReturnableResponse>> = {}) =>
  ({ isLoading: false, isError: false, ...over }) as UseQueryResult<ReturnableResponse>;

const base = {
  invoiceId: "inv1",
  pickInvoice: vi.fn(),
  invoicesQ: { data: { invoices: [] }, isLoading: false } as never,
  date: "2026-07-01",
  setDate: vi.fn(),
  returnableQ: rq(),
  lines: [line],
  qty: {},
  setQty: vi.fn(),
  outstanding: 500,
  total: 100,
  overCap: false,
  reason: "",
  setReason: vi.fn(),
  proofFile: null as File | null,
  setProofFile: vi.fn(),
  error: null as string | null,
};

describe("SalesReturnFields", () => {
  it("shows the lines table + totals for a picked invoice", () => {
    render(<SalesReturnFields {...base} />);
    expect(screen.getByText("picker")).toBeInTheDocument();
    expect(screen.getByText("lines-table")).toBeInTheDocument();
    expect(screen.getByText(/Return total:/)).toHaveTextContent("₹100");
    expect(screen.getByText("reason-proof")).toBeInTheDocument();
  });

  it("shows a loading state for the returnable query", () => {
    render(<SalesReturnFields {...base} returnableQ={rq({ isLoading: true })} />);
    expect(screen.getByText(/Loading invoice lines/)).toBeInTheDocument();
    expect(screen.queryByText("lines-table")).not.toBeInTheDocument();
  });

  it("shows an error state for the returnable query", () => {
    render(<SalesReturnFields {...base} returnableQ={rq({ isError: true, error: new Error("x") })} />);
    expect(screen.getByText(/Couldn’t load this invoice’s lines/)).toBeInTheDocument();
  });

  it("renders nothing invoice-specific until an invoice is picked, and flags over-cap", () => {
    const { rerender } = render(<SalesReturnFields {...base} invoiceId="" />);
    expect(screen.queryByText("lines-table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Return total:/)).not.toBeInTheDocument();

    rerender(<SalesReturnFields {...base} overCap error="Boom" />);
    expect(screen.getByText(/can’t exceed what’s still outstanding/)).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
