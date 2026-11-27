import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomerPicker } from "./customer-picker";

const cust = (over: Record<string, unknown> = {}) =>
  ({ id: "c1", name: "Acme Traders", code: "C1", address: "MG Road", ...over }) as never;

const base = {
  customer: null as never,
  customerSearch: "",
  trimmedSearch: "",
  filteredCustomers: [],
  pending: false,
  setCustomer: vi.fn(),
  setCustomerSearch: vi.fn(),
  clearError: vi.fn(),
};

describe("CustomerPicker", () => {
  it("searches (clearing error), clears the box, and selects a result", () => {
    const setCustomer = vi.fn();
    const setCustomerSearch = vi.fn();
    const clearError = vi.fn();
    render(
      <CustomerPicker
        {...base}
        customerSearch="ac"
        trimmedSearch="ac"
        filteredCustomers={[cust()]}
        setCustomer={setCustomer}
        setCustomerSearch={setCustomerSearch}
        clearError={clearError}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search name or area/), { target: { value: "beta" } });
    expect(setCustomerSearch).toHaveBeenCalledWith("beta");
    expect(clearError).toHaveBeenCalled();
    fireEvent.click(screen.getByText("✕")); // clear the search box
    expect(setCustomerSearch).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByText("Acme Traders")); // pick a result
    expect(setCustomer).toHaveBeenCalled();
  });

  it("shows the selected customer card and changes it", () => {
    const setCustomer = vi.fn();
    const setCustomerSearch = vi.fn();
    render(<CustomerPicker {...base} customer={cust()} setCustomer={setCustomer} setCustomerSearch={setCustomerSearch} />);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("MG Road")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Change"));
    expect(setCustomer).toHaveBeenCalledWith(null);
    expect(setCustomerSearch).toHaveBeenCalledWith("");
  });

  it("omits the address line for a selected customer with no address", () => {
    render(<CustomerPicker {...base} customer={cust({ address: null })} />);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.queryByText("MG Road")).not.toBeInTheDocument();
  });

  it("hides the clear control when the search box is empty", () => {
    render(<CustomerPicker {...base} customerSearch="" />);
    expect(screen.queryByText("✕")).not.toBeInTheDocument();
  });
});
