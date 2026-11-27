import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomerResults } from "./customer-results";

const cust = (over: Record<string, unknown> = {}) =>
  ({ id: "c1", name: "Acme Traders", code: "C1", address: "MG Road", ...over }) as never;

describe("CustomerResults", () => {
  it("renders nothing until the user types", () => {
    const { container } = render(
      <CustomerResults trimmedSearch="" pending={false} filteredCustomers={[]} onSelect={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows a skeleton while pending", () => {
    const { container } = render(
      <CustomerResults trimmedSearch="ac" pending filteredCustomers={[]} onSelect={() => {}} />,
    );
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("shows the no-match message", () => {
    render(<CustomerResults trimmedSearch="zzz" pending={false} filteredCustomers={[]} onSelect={() => {}} />);
    expect(screen.getByText(/No customers match/)).toBeInTheDocument();
  });

  it("renders result cards and selects one", () => {
    const onSelect = vi.fn();
    render(
      <CustomerResults
        trimmedSearch="ac"
        pending={false}
        filteredCustomers={[cust(), cust({ id: "c2", name: "Beta", code: null, address: null })]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("MG Road")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Beta")); // card without code/address still selects
    expect(onSelect).toHaveBeenCalled();
  });
});
