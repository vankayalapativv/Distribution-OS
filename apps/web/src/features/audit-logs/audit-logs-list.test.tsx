import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a) };
});
const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (o: unknown) => useQuery(o) }));
const usePagedTable = vi.fn();
vi.mock("@/components/data-table/use-paged-table", () => ({ usePagedTable: (o: unknown) => usePagedTable(o) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/audit-logs",
}));
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
vi.mock("@/components/data-table/data-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ empty }: any) => <div data-testid="table">{empty}</div>,
}));
vi.mock("./audit-logs-filters", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AuditLogsFilters: ({ total }: any) => <div>filters:{total}</div>,
}));
vi.mock("./use-audit-filters", () => ({
  AUDIT_SORT: [{ id: "createdAt", desc: true }],
  useAuditFilters: () => ({ serverFilters: { q: "" }, hasFilters: false }),
}));

import { AuditLogsList } from "./audit-logs-list";

const config = { apiBaseUrl: "", authToken: "" };
const paged = { table: {}, total: 7, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null };

beforeEach(() => { vi.clearAllMocks(); useQuery.mockReturnValue({ data: undefined }); usePagedTable.mockReturnValue(paged); });
afterEach(() => vi.restoreAllMocks());

describe("AuditLogsList", () => {
  it("wires the paged table to the audit endpoint and shows the event count", () => {
    render(<AuditLogsList actionConfig={config} />);
    expect(screen.getByText("7 events")).toBeInTheDocument();
    expect(screen.getByText("filters:7")).toBeInTheDocument();
    const cfg = usePagedTable.mock.calls.at(-1)![0];
    expect(cfg.path).toBe("/audit-logs/paged");
    expect(cfg.rowsKey).toBe("auditLogs");
    // Empty prompt for the no-filter case.
    expect(screen.getByText("No audit events recorded yet.")).toBeInTheDocument();
  });

  it("the filters query calls apiGet for the distinct-values endpoint", () => {
    render(<AuditLogsList actionConfig={config} />);
    const { queryFn } = useQuery.mock.calls.at(-1)![0];
    queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, "/audit-logs/filters");
  });

  it("surfaces a table error", () => {
    usePagedTable.mockReturnValue({ ...paged, error: { message: "Boom" } });
    render(<AuditLogsList actionConfig={config} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("shows a loading subtitle, and a singular event label", () => {
    usePagedTable.mockReturnValue({ ...paged, isLoading: true });
    const { rerender } = render(<AuditLogsList actionConfig={config} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    usePagedTable.mockReturnValue({ ...paged, total: 1 });
    rerender(<AuditLogsList actionConfig={config} />);
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });
});
