import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/shell/dashboard-shell", () => ({
  DashboardShell: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
}));
vi.mock("@/components/data-table/query-provider", () => ({
  withQueryClient: (C: (p: unknown) => React.ReactNode) => C,
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: (p: { title: React.ReactNode; subtitle: React.ReactNode; action: React.ReactNode }) => (
    <div>
      <h1>{p.title}</h1>
      <div>{p.subtitle}</div>
      <div>{p.action}</div>
    </div>
  ),
}));
vi.mock("./users-filter-bar", () => ({ UsersFilterBar: () => <div>filter-bar</div> }));
vi.mock("./users-columns", () => ({
  buildUserColumns: vi.fn(() => [{ id: "name" }]),
  userColumns: [{ id: "name" }],
  userSkeleton: [],
}));
vi.mock("@/components/data-table/data-table", () => ({
  DataTable: (p: { empty: React.ReactNode }) => <div data-testid="empty">{p.empty}</div>,
}));
vi.mock("./users-dialogs", () => ({
  UsersDialogs: (p: { state: { addOpen: boolean } }) => (p.state.addOpen ? <div>add-open</div> : null),
}));

const listState = {
  url: { setFilter: vi.fn(), hasFilters: false },
  filters: { role: "", status: "" },
  search: "",
  setSearch: vi.fn(),
  refresh: vi.fn(),
  table: {},
  total: 2,
  pageCount: 1,
  pageSize: 8,
  isLoading: false,
  showSkeleton: false,
  error: null as { message: string } | null,
};
vi.mock("./use-super-admin-users", () => ({ useSuperAdminUsers: () => listState }));

import { SuperAdminSetup } from "./super-admin-setup";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof listState> = {}) => {
  Object.assign(listState, { total: 2, error: null, isLoading: false }, over);
  Object.assign(listState.url, { hasFilters: false });
};
describe("SuperAdminSetup (Users)", () => {
  it("renders a Users-only page: title, count subtitle, Add button", () => {
    reset();
    render(<SuperAdminSetup actionConfig={cfg} currentUserId="me" />);
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("2 users")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add User" })).toBeInTheDocument();
  });
  it("no longer offers Teams or Territories", () => {
    reset();
    render(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.queryByRole("button", { name: "Add Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Territories" })).not.toBeInTheDocument();
  });
  it("opens the Add User dialog from the header button", () => {
    reset();
    render(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.queryByText("add-open")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Add User" }));
    expect(screen.getByText("add-open")).toBeInTheDocument();
  });
  it("shows a Loading… subtitle while the table loads", () => {
    reset({ isLoading: true });
    render(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
  it("shows the default empty text, and the filtered text when filters are active", () => {
    reset();
    const { rerender } = render(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.getByTestId("empty")).toHaveTextContent("No users yet.");
    Object.assign(listState.url, { hasFilters: true });
    rerender(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.getByTestId("empty")).toHaveTextContent("No users match your filters.");
  });
  it("renders an error banner when the list errors", () => {
    reset({ error: { message: "Boom" } });
    render(<SuperAdminSetup actionConfig={cfg} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
  it("defaults actionConfig + currentUserId when omitted", () => {
    reset();
    render(<SuperAdminSetup />);
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
  });
});
