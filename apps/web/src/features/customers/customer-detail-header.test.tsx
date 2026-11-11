import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/page-header", () => ({
  PageHeader: (p: { title: string; subtitle: React.ReactNode; action: React.ReactNode }) => (
    <div>
      <h1>{p.title}</h1>
      <div>{p.subtitle}</div>
      <div>{p.action}</div>
    </div>
  ),
}));
vi.mock("@/components/status-badge", () => ({ StatusBadge: (p: { status: string }) => <span>st:{p.status}</span> }));
vi.mock("./customer-statement-link-menu", () => ({
  CustomerStatementLinkMenu: () => <button type="button">⋮</button>,
}));

import { CustomerDetailHeader } from "./customer-detail-header";
import type { Customer } from "./customers-api";

const actionConfig = { apiBaseUrl: "http://localhost/api/v1", authToken: "t" };

const customer = (over: Partial<Customer> = {}): Customer =>
  ({
    id: "c1",
    legalName: "Raj Motors",
    status: "active",
    customerCode: "CUST-0001",
    salesExecutiveName: "Ravi",
    ...over,
  }) as unknown as Customer;

describe("CustomerDetailHeader", () => {
  it("shows title, status, exec, code and the edit actions when allowed", () => {
    const onEdit = vi.fn();
    const onStatus = vi.fn();
    render(
      <CustomerDetailHeader
        customer={customer()}
        canEdit
        onEdit={onEdit}
        onStatus={onStatus}
        actionConfig={actionConfig}
      />,
    );
    expect(screen.getByRole("heading", { name: "Raj Motors" })).toBeInTheDocument();
    expect(screen.getByText("st:active")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("CUST-0001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change Status" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onStatus).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
  });

  it("hides the actions and the exec name when not editable / absent", () => {
    render(
      <CustomerDetailHeader
        customer={customer({ salesExecutiveName: null })}
        canEdit={false}
        onEdit={vi.fn()}
        onStatus={vi.fn()}
        actionConfig={actionConfig}
      />,
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ravi")).not.toBeInTheDocument();
  });
});
