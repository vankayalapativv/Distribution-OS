import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: unknown) => C }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/shell/new-items-banner", () => ({ NewItemsBanner: () => <div /> }));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, action }: { readonly title: string; readonly action?: React.ReactNode }) => <div><h1>{title}</h1>{action}</div>,
}));
vi.mock("./collections-filter-bar", () => ({ CollectionsFilterBar: () => <div data-testid="filter-bar" /> }));
vi.mock("./collections-create-dialog", () => ({
  CollectionsCreateDialog: ({ open }: { readonly open: boolean }) => (open ? <div data-testid="create-open" /> : null),
}));
vi.mock("@/components/data-table/data-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ onRowClick, empty }: any) => (
    <div><button onClick={() => onRowClick({ id: "c1" })}>row</button><div>{empty}</div></div>
  ),
}));

const hook = {
  url: { setFilter: vi.fn(), clearFilters: vi.fn() }, queryClient: { invalidateQueries: vi.fn() },
  search: "", setSearch: vi.fn(), statusFilter: "all", collectedBy: "", customerId: "", customerName: null,
  collectionDate: undefined, pendingCount: 0, newCount: 0, highlightSince: null, acknowledge: vi.fn(),
  hasFilters: false, table: {}, total: 3, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null,
};
vi.mock("./use-collections-list", () => ({ useCollectionsList: () => hook }));

import { CollectionsList } from "./collections-list";

const config = { apiBaseUrl: "", authToken: "" };
const props = { customers: [], collectors: [], actionConfig: config };

describe("CollectionsList", () => {
  it("renders the page and filter bar", () => {
    render(<CollectionsList {...props} role="MANAGER" />);
    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
  });

  it("opens the create dialog from the header action (manager)", () => {
    render(<CollectionsList {...props} role="MANAGER" />);
    expect(screen.queryByTestId("create-open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("+ Record Collection"));
    expect(screen.getByTestId("create-open")).toBeInTheDocument();
  });

  it("hides create for an accountant", () => {
    render(<CollectionsList {...props} role="ACCOUNTANT" />);
    expect(screen.queryByText("+ Record Collection")).not.toBeInTheDocument();
  });

  it("navigates to a collection on row click", () => {
    render(<CollectionsList {...props} role="MANAGER" />);
    fireEvent.click(screen.getByText("row"));
    expect(push).toHaveBeenCalledWith("/collections/c1");
  });
});
