import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const s = {
  total: 3, error: null as { message: string } | null, table: {}, pageSize: 8, pageCount: 1, showSkeleton: false,
  setCreateOpen: vi.fn(), createOpen: false, openPdf: vi.fn(), invalidate: vi.fn(),
};
vi.mock("./use-invoices-list", () => ({ useInvoicesList: () => s }));
vi.mock("@/components/data-table/query-provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withQueryClient: (C: any) => C,
}));
vi.mock("@/features/shell/dashboard-shell", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DashboardShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/page-header", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageHeader: ({ subtitle }: any) => <p>{subtitle}</p>,
}));
vi.mock("./invoices-search-bar", () => ({ InvoicesSearchBar: () => <div>SEARCH</div> }));
vi.mock("@/components/data-table/data-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ empty, onRowClick }: any) => <div><button onClick={() => onRowClick({ id: "i1" })}>row</button>{empty}</div>,
}));

import { InvoicesList } from "./invoices-list";

const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => { s.error = null; s.createOpen = false; });

describe("InvoicesList", () => {
  it("renders the count subtitle, search bar, table; a row click opens the PDF", () => {
    render(<InvoicesList role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByText(/3 invoices/)).toBeInTheDocument();
    expect(screen.getByText("SEARCH")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("row"));
    expect(s.openPdf).toHaveBeenCalledWith({ id: "i1" });
  });

  it("shows an error banner when the list errors", () => {
    s.error = { message: "Boom" };
    render(<InvoicesList role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
