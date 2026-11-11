import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ items, onSelect, getLabel, renderOption, renderTrigger }: any) => (
    <div>
      <div data-testid="labels">{items.map(getLabel).join("|")}</div>
      <div data-testid="option">{renderOption(items[0])}</div>
      <div data-testid="trigger">{renderTrigger(null)}</div>
      <button onClick={() => onSelect("c1")}>pick</button>
    </div>
  ),
}));

import { TaskCustomerSelect } from "./task-customer-select";
import type { CustomerLite } from "./tasks-api";

const customers: CustomerLite[] = [
  { id: "c1", legalName: "Sri Laxmi", customerCode: "CUST-1", city: "Nalgonda", salesExecutiveName: "Ravi" },
];

describe("TaskCustomerSelect", () => {
  it("builds a searchable label and renders the option + placeholder trigger", () => {
    render(<TaskCustomerSelect customers={customers} value="" onChange={() => {}} selectedCustomer={null} />);
    expect(screen.getByTestId("labels").textContent).toContain("CUST-1");
    expect(screen.getByTestId("option").textContent).toContain("Sri Laxmi");
    expect(screen.getByTestId("trigger").textContent).toContain("No customer linked");
  });

  it("renders an option without the sub-line when city + exec are absent", () => {
    render(
      <TaskCustomerSelect
        customers={[{ id: "c2", legalName: "Balaji", customerCode: "CUST-2", city: null, salesExecutiveName: null }]}
        value="" onChange={() => {}} selectedCustomer={null}
      />,
    );
    expect(screen.getByTestId("option").textContent).toBe("Balaji"); // no " · " sub-line
  });

  it("selects a customer and clears it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TaskCustomerSelect customers={customers} value="" onChange={onChange} selectedCustomer={null} />);
    fireEvent.click(screen.getByText("pick"));
    expect(onChange).toHaveBeenCalledWith("c1");
    rerender(<TaskCustomerSelect customers={customers} value="c1" onChange={onChange} selectedCustomer={customers[0]} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
