import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));
vi.mock("@/components/data-table/query-provider", () => ({
  withQueryClient: (C: (p: unknown) => React.ReactNode) => C,
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: (p: { subtitle: React.ReactNode; action: React.ReactNode }) => (
    <div>
      <div>{p.subtitle}</div>
      <div>{p.action}</div>
    </div>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("./customers-filter-bar", () => ({
  CustomersFilterBar: (p: { onDownload: () => void }) => (
    <button onClick={p.onDownload}>bar-download</button>
  ),
}));
vi.mock("./customers-columns", () => ({ customerColumns: [{ id: "legalName" }], customerSkeleton: [] }));
vi.mock("./customers-create-dialog", () => ({
  CustomerCreateDialog: (p: { open: boolean }) => (p.open ? <div>create-dialog</div> : null),
}));
vi.mock("@/components/data-table/data-table", () => ({
  DataTable: (p: { empty: React.ReactNode; onRowClick: (r: { id: string }) => void }) => (
    <div>
      <button onClick={() => p.onRowClick({ id: "c9" })}>row</button>
      <div data-testid="empty">{p.empty}</div>
    </div>
  ),
}));

const pushMock = vi.fn();
const listState = {
  url: { setFilter: vi.fn(), hasFilters: false },
  filters: { city: "", salesExecutiveId: "", dues: "" },
  search: "",
  setSearch: vi.fn(),
  cities: [],
  salesExecutives: [],
  table: { getState: () => ({ sorting: [] }) },
  total: 2,
  pageCount: 1,
  pageSize: 8,
  isLoading: false,
  showSkeleton: false,
  error: null as { message: string } | null,
  downloading: false,
  downloadPdf: vi.fn(),
};
vi.mock("./use-customers-list", () => ({ useCustomersList: () => listState }));

import { CustomersList } from "./customers-list";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof listState> = {}) => {
  Object.assign(listState, { total: 2, error: null, isLoading: false }, over);
  Object.assign(listState.url, { hasFilters: false });
  pushMock.mockClear();
  listState.downloadPdf.mockClear();
};

describe("CustomersList", () => {
  it("shows the count subtitle, add button, and routes on row click (editable role)", () => {
    reset();
    render(<CustomersList role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("2 customers in your organisation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Customer" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("row"));
    expect(pushMock).toHaveBeenCalledWith("/customers/c9");

    fireEvent.click(screen.getByText("bar-download"));
    expect(listState.downloadPdf).toHaveBeenCalled();
  });

  it("opens the create dialog from header + the empty-state button", () => {
    reset();
    render(<CustomersList role="MANAGER" actionConfig={cfg} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Customer" }));
    expect(screen.getByText("create-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("empty")).toHaveTextContent("No customers yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add your first customer" }));
  });

  it("shows a Loading… subtitle while the table loads", () => {
    reset({ isLoading: true });
    render(<CustomersList role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("hides create + shows the filtered empty text for read-only roles", () => {
    reset();
    Object.assign(listState.url, { hasFilters: true });
    render(<CustomersList role="ACCOUNTANT" actionConfig={cfg} />);
    expect(screen.queryByRole("button", { name: "+ Add Customer" })).not.toBeInTheDocument();
    expect(screen.getByTestId("empty")).toHaveTextContent("No customers match your filters.");
  });

  it("shows an error banner and a singular subtitle", () => {
    reset({ total: 1, error: { message: "Boom" } });
    render(<CustomersList role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByText("1 customer in your organisation")).toBeInTheDocument();
  });
});
