import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Alert } from "./alerts-api";

vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, subtitle }: { readonly title: string; readonly subtitle?: React.ReactNode }) => <div><h1>{title}</h1><div>{subtitle}</div></div>,
}));
vi.mock("./alerts-status-filter", () => ({ AlertsStatusFilter: () => <div data-testid="filter" /> }));
vi.mock("./alerts-empty", () => ({ AlertsEmpty: () => <div data-testid="empty" /> }));
vi.mock("./alert-card", () => ({ AlertCard: ({ alert }: { readonly alert: Alert }) => <div data-testid="card">{alert.id}</div> }));

const hook = {
  alerts: [] as Alert[], statusFilter: "open" as const, setStatusFilter: vi.fn(),
  closingId: null as string | null, filtered: [] as Alert[], openCount: 0, handleClose: vi.fn(),
};
vi.mock("./use-alerts", () => ({ useAlerts: () => hook }));

import { AlertsList } from "./alerts-list";

const config = { apiBaseUrl: "", authToken: "" };
const alert = (id: string): Alert => ({ id } as Alert);

describe("AlertsList", () => {
  it("shows the count + open badge and the filter", () => {
    hook.alerts = [alert("a1"), alert("a2")];
    hook.openCount = 2;
    hook.filtered = [];
    render(<AlertsList alerts={hook.alerts} role="MANAGER" actionConfig={config} />);
    expect(screen.getByText(/2 alerts/)).toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByTestId("filter")).toBeInTheDocument();
  });

  it("renders the empty state when nothing is filtered in", () => {
    hook.filtered = [];
    render(<AlertsList alerts={hook.alerts} role="MANAGER" actionConfig={config} />);
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });

  it("renders a card per filtered alert", () => {
    hook.filtered = [alert("a1"), alert("a2")];
    render(<AlertsList alerts={hook.alerts} role="MANAGER" actionConfig={config} />);
    expect(screen.getAllByTestId("card")).toHaveLength(2);
    expect(screen.queryByTestId("empty")).not.toBeInTheDocument();
  });

  it("omits the open badge when nothing is open", () => {
    hook.openCount = 0;
    hook.alerts = [alert("a1")];
    hook.filtered = [alert("a1")];
    render(<AlertsList alerts={hook.alerts} role="MANAGER" actionConfig={config} />);
    expect(screen.getByText(/1 alert/)).toBeInTheDocument();
    expect(screen.queryByText(/open/)).not.toBeInTheDocument();
  });
});
