import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/customers/customer-search-select", () => ({
  CustomerSearchSelect: () => <div data-testid="customer-picker" />,
}));
vi.mock("./search-select", () => ({
  SearchSelect: ({
    items,
    getKey,
    getLabel,
  }: {
    readonly items: { id: string; name: string }[];
    readonly getKey: (i: { id: string; name: string }) => string;
    readonly getLabel: (i: { id: string; name: string }) => string;
  }) => (
    <div data-testid="se-select">{items.map((i) => `${getKey(i)}:${getLabel(i)}`).join(",")}</div>
  ),
}));
vi.mock("./order-date-field", () => ({
  OrderDateField: () => <div data-testid="date-field" />,
}));

import { OrderHeaderFields } from "./order-header-fields";
import type { ActionConfig } from "@/lib/api-client";

const actionConfig = { apiBaseUrl: "", authToken: "" } as ActionConfig;

function base(over: Partial<Parameters<typeof OrderHeaderFields>[0]> = {}) {
  render(
    <OrderHeaderFields
      actionConfig={actionConfig}
      customers={[]}
      salesExecutives={[{ id: "se1", name: "Anika" }]}
      selectedCustomerId=""
      onCustomerChange={vi.fn()}
      selectedSalesExecId=""
      onSalesExecChange={vi.fn()}
      orderDate={undefined}
      onOrderDateChange={vi.fn()}
      orderDateOpen={false}
      onOrderDateOpenChange={vi.fn()}
      {...over}
    />,
  );
}

describe("OrderHeaderFields", () => {
  it("renders the customer picker, date field and SE select (with a leading None)", () => {
    base();
    expect(screen.getByTestId("customer-picker")).toBeInTheDocument();
    expect(screen.getByTestId("date-field")).toBeInTheDocument();
    expect(screen.getByTestId("se-select")).toHaveTextContent(":None,se1:Anika");
  });

  it("shows the customer read-only when locked", () => {
    base({ lockCustomer: true, selectedCustomerLabel: "Sri Traders" });
    expect(screen.getByText("Sri Traders")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-picker")).not.toBeInTheDocument();
  });

  it("falls back to an em-dash when locked with no label", () => {
    base({ lockCustomer: true, selectedCustomerLabel: null });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
