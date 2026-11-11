import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./search-select", () => ({
  SearchSelect: (p: any) => {
    const selected = p.items.find((i: any) => p.getKey(i) === p.valueKey);
    return (
      <div data-testid="search-select">
        <div data-testid="trigger">{p.renderTrigger(selected)}</div>
        {p.items.map((i: any) => (
          <div key={p.getKey(i)} data-testid={`opt-${p.getKey(i) || "all"}`} title={p.getLabel(i)}>
            {p.renderOption(i)}
          </div>
        ))}
        <button onClick={() => p.onSelect("se1")}>pick</button>
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersSalesExecFilter } from "./orders-sales-exec-filter";
import type { SalesExecutive } from "./orders-api";

const ses: SalesExecutive[] = [
  { id: "se1", name: "Anika Sharma" },
  { id: "se2", name: "Ravi" },
];

afterEach(() => vi.restoreAllMocks());

describe("OrdersSalesExecFilter", () => {
  it("shows the placeholder trigger + avatar options when none is selected", () => {
    render(<OrdersSalesExecFilter salesExecutiveId="" onSalesExecChange={() => {}} salesExecutives={ses} />);
    expect(within(screen.getByTestId("trigger")).getByText("All executives")).toBeInTheDocument();
    // The real-executive option renders its initials avatar.
    expect(within(screen.getByTestId("opt-se1")).getByText("AS")).toBeInTheDocument();
    expect(within(screen.getByTestId("opt-all")).getByText("All executives")).toBeInTheDocument();
  });

  it("shows the selected executive (name + avatar) in the trigger", () => {
    render(<OrdersSalesExecFilter salesExecutiveId="se1" onSalesExecChange={() => {}} salesExecutives={ses} />);
    const trigger = screen.getByTestId("trigger");
    expect(within(trigger).getByText("Anika Sharma")).toBeInTheDocument();
    expect(within(trigger).getByText("AS")).toBeInTheDocument();
  });

  it("fires onSalesExecChange when an option is picked", () => {
    const onChange = vi.fn();
    render(<OrdersSalesExecFilter salesExecutiveId="" onSalesExecChange={onChange} salesExecutives={ses} />);
    fireEvent.click(screen.getByRole("button", { name: "pick" }));
    expect(onChange).toHaveBeenCalledWith("se1");
  });
});
