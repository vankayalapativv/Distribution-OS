import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can: Record<string, boolean> = {};
vi.mock("@/features/shell/use-can", () => ({ useCan: (k: string) => can[k] ?? false }));
const claims = { claims: [] as unknown[] };
vi.mock("./use-claims-queue", () => ({ useClaimsQueue: () => claims }));
let tab: string | null = null;
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: (k: string) => (k === "tab" ? tab : null) }) }));
vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: unknown) => C }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./claims-queue-panel", () => ({ ClaimsQueuePanel: () => <div>CLAIMS-BODY</div> }));
vi.mock("./advances-panel", () => ({ AdvancesPanel: () => <div>ADV-BODY</div> }));
vi.mock("./salary-panel", () => ({ SalaryPanel: () => <div>SALARY-BODY</div> }));
vi.mock("./employee-ledger-dialog", () => ({ EmployeeLedgerDialogBody: () => <div>LEDGER-BODY</div> }));

import { ExpenditureDesk } from "./expenditure-desk";

const config = { apiBaseUrl: "", authToken: "" };
const ALL = {
  "action:expenditures.claims.approve": true,
  "action:expenditures.advances.manage": true,
  "action:salary.view": true,
  "action:expenditures.manage": true,
};
const render1 = () => render(<ExpenditureDesk role="SUPER_ADMIN" actionConfig={config} />);
beforeEach(() => { vi.clearAllMocks(); Object.keys(can).forEach((k) => delete can[k]); claims.claims = []; tab = null; });
afterEach(() => vi.clearAllMocks());

describe("ExpenditureDesk", () => {
  it("shows permitted tabs, defaults to the first, and switches on click", () => {
    Object.assign(can, ALL);
    render1();
    expect(screen.getByText("Expense desk")).toBeInTheDocument();
    expect(screen.getByText("CLAIMS-BODY")).toBeInTheDocument(); // first tab active
    fireEvent.click(screen.getByText("Salary & pay"));
    expect(screen.getByText("SALARY-BODY")).toBeInTheDocument();
    expect(screen.queryByText("CLAIMS-BODY")).not.toBeInTheDocument();
  });

  it("opens the tab named in ?tab=", () => {
    Object.assign(can, ALL);
    tab = "ledger";
    render1();
    expect(screen.getByText("LEDGER-BODY")).toBeInTheDocument();
  });

  it("falls back to the first tab for an unknown or forbidden ?tab=", () => {
    Object.assign(can, { "action:expenditures.advances.manage": true }); // only Advances
    tab = "salary"; // not permitted → ignored
    render1();
    expect(screen.getByText("ADV-BODY")).toBeInTheDocument();
  });

  it("follows a ?tab= change (deep-link from the kebab)", () => {
    Object.assign(can, ALL);
    const { rerender } = render1();
    expect(screen.getByText("CLAIMS-BODY")).toBeInTheDocument();
    tab = "advances";
    rerender(<ExpenditureDesk role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("ADV-BODY")).toBeInTheDocument();
    // A later change to an empty/invalid ?tab= leaves the active tab as-is.
    tab = null;
    rerender(<ExpenditureDesk role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("ADV-BODY")).toBeInTheDocument();
  });

  it("badges the Claims tab with the pending count", () => {
    Object.assign(can, { "action:expenditures.claims.approve": true });
    claims.claims = [1, 2];
    render1();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows an empty note when the user has access to no area", () => {
    render1();
    expect(screen.getByText(/don.t have access to any of these areas/)).toBeInTheDocument();
  });
});
