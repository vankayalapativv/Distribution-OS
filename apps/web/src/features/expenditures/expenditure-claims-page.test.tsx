import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can = { approve: true };
vi.mock("@/features/shell/use-can", () => ({ useCan: () => can.approve }));
vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: unknown) => C }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./claims-queue-panel", () => ({ ClaimsQueuePanel: () => <div>CLAIMS-BODY</div> }));

import { ExpenditureClaimsPage } from "./expenditure-claims-page";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); can.approve = true; });
afterEach(() => vi.clearAllMocks());

describe("ExpenditureClaimsPage", () => {
  it("renders the claims queue for an approver", () => {
    render(<ExpenditureClaimsPage role="SUPER_ADMIN" actionConfig={config} />);
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("CLAIMS-BODY")).toBeInTheDocument();
  });

  it("shows a no-access note without the approve permission", () => {
    can.approve = false;
    render(<ExpenditureClaimsPage role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.queryByText("CLAIMS-BODY")).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have access to claims/)).toBeInTheDocument();
  });
});
