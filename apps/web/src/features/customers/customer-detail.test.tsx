import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
const h = vi.hoisted(() => ({
  state: { data: { id: "c1", legalName: "Raj Motors" } as unknown, isError: false },
  captured: undefined as { queryFn: () => unknown } | undefined,
}));
vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));
vi.mock("@/components/data-table/query-provider", () => ({
  withQueryClient: (C: (p: unknown) => React.ReactNode) => C,
}));
const apiGet = vi.fn(async (..._a: unknown[]) => ({ id: "c1" }));
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryFn: () => unknown }) => { h.captured = c; return h.state; },
}));
vi.mock("./customer-detail-sections", () => ({ INFO_TABS: [{ key: "details", label: "Details" }] }));
vi.mock("./use-customer-detail-data", () => ({
  useCustomerDetailData: () => ({
    photos: [],
    photosLoading: false,
    orders: [],
    ordersTotal: 0,
    ordersLoading: false,
    visitsCount: 0,
    visitsLoading: false,
  }),
}));
vi.mock("./customer-detail-header", () => ({
  CustomerDetailHeader: (p: { canEdit: boolean; onEdit: () => void; onStatus: () => void }) => (
    <div>
      <span>header canEdit:{String(p.canEdit)}</span>
      <button onClick={p.onEdit}>hdr-edit</button>
      <button onClick={p.onStatus}>hdr-status</button>
    </div>
  ),
}));
vi.mock("./customer-detail-tabbar", () => ({
  CustomerDetailTabBar: (p: { onSelect: (k: string) => void }) => (
    <button onClick={() => p.onSelect("orders")}>go-orders</button>
  ),
}));
vi.mock("./customer-detail-tab-content", () => ({
  CustomerDetailTabContent: (p: { activeTab: string }) => <div>content:{p.activeTab}</div>,
}));
vi.mock("./customer-edit-dialog", () => ({
  CustomerEditDialog: (p: { open: boolean }) => (p.open ? <div>edit-dialog</div> : null),
}));
vi.mock("./customer-status-dialog", () => ({
  CustomerStatusDialog: (p: { open: boolean }) => (p.open ? <div>status-dialog</div> : null),
}));
import { CustomerDetail } from "./customer-detail";
const cfg = { apiBaseUrl: "x", authToken: "t" };

afterEach(() => {
  h.state = { data: { id: "c1", legalName: "Raj Motors" }, isError: false };
  apiGet.mockClear();
});

describe("CustomerDetail", () => {
  it("opens the edit + status dialogs from the header (editable roles)", () => {
    render(<CustomerDetail customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("header canEdit:true")).toBeInTheDocument();
    expect(screen.getByText("content:details")).toBeInTheDocument();

    fireEvent.click(screen.getByText("hdr-edit"));
    expect(screen.getByText("edit-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("hdr-status"));
    expect(screen.getByText("status-dialog")).toBeInTheDocument();
  });
  it("switches the active tab via the tab bar", () => {
    render(<CustomerDetail customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />);
    fireEvent.click(screen.getByText("go-orders"));
    expect(screen.getByText("content:orders")).toBeInTheDocument();
  });
  it("hides the edit dialogs for a read-only role (ACCOUNTANT)", () => {
    render(<CustomerDetail customerId="c1" role="ACCOUNTANT" actionConfig={cfg} />);
    expect(screen.getByText("header canEdit:false")).toBeInTheDocument();
    fireEvent.click(screen.getByText("hdr-edit")); // no-op: dialogs not mounted
    expect(screen.queryByText("edit-dialog")).not.toBeInTheDocument();
  });
  it("shows the skeleton while the customer is still loading", () => {
    h.state = { data: undefined, isError: false };
    render(<CustomerDetail customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText("Photos")).toBeInTheDocument(); // skeleton's static tab labels
    expect(screen.queryByText("content:details")).not.toBeInTheDocument();
  });
  it("shows the not-found message when the fetch errors", () => {
    h.state = { data: undefined, isError: true };
    render(<CustomerDetail customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />);
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
  });
  it("the queryFn fetches the customer by id", async () => {
    render(<CustomerDetail customerId="c1" role="SUPER_ADMIN" actionConfig={cfg} />);
    await h.captured!.queryFn();
    expect(apiGet).toHaveBeenCalledWith(cfg, "/customers/c1");
  });
});
