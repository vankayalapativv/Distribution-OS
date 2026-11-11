import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/customers/customer-search-select", () => ({
  CustomerSearchSelect: ({ onSelect }: { readonly onSelect: (id: string) => void }) => (
    <button data-testid="customer-picker" onClick={() => onSelect("cu9")}>pick-customer</button>
  ),
}));
vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: ({ onSelect, renderOption }: any) => (
    <div data-testid="collector-picker">
      <button onClick={() => onSelect("u9")}>pick-collector</button>
      <span data-testid="opt-with-role">{renderOption({ id: "u9", name: "Ravi", roleLabel: "Sales Exec" })}</span>
      <span data-testid="opt-no-role">{renderOption({ id: "u8", name: "Anil", roleLabel: "" })}</span>
    </div>
  ),
}));

import { CollectionFormFields } from "./collections-form-fields";
import { EMPTY_COLLECTION_FORM } from "./collection-form-types";

const config = { apiBaseUrl: "", authToken: "" };
const common = {
  form: EMPTY_COLLECTION_FORM,
  setForm: vi.fn(),
  customers: [],
  collectors: [],
  proofFile: null,
  onProofChange: vi.fn(),
  actionConfig: config,
};

describe("CollectionFormFields", () => {
  it("shows the searchable customer picker when unlocked", () => {
    render(<CollectionFormFields {...common} />);
    expect(screen.getByTestId("customer-picker")).toBeInTheDocument();
    expect(screen.getByTestId("collector-picker")).toBeInTheDocument();
    expect(screen.getByText(/Upload receipt/)).toBeInTheDocument(); // ProofPicker
  });

  it("shows a read-only customer field when locked", () => {
    render(<CollectionFormFields {...common} lockedCustomerLabel="Sri Laxmi — CUST-1" />);
    expect(screen.getByText("Sri Laxmi — CUST-1")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-picker")).not.toBeInTheDocument();
  });

  it("edits the remarks field", () => {
    function Harness() {
      const [form, setForm] = useState(EMPTY_COLLECTION_FORM);
      return <CollectionFormFields {...common} form={form} setForm={setForm} />;
    }
    render(<Harness />);
    const input = screen.getByPlaceholderText("Optional notes");
    fireEvent.change(input, { target: { value: "paid in full" } });
    expect(input).toHaveValue("paid in full");
  });

  it("selects a customer and a collector via the pickers", () => {
    const setForm = vi.fn();
    render(<CollectionFormFields {...common} setForm={setForm} />);
    fireEvent.click(screen.getByText("pick-customer"));
    fireEvent.click(screen.getByText("pick-collector"));
    const [customerUpdater, collectorUpdater] = setForm.mock.calls.map((c) => c[0]);
    expect(customerUpdater(EMPTY_COLLECTION_FORM).customerId).toBe("cu9");
    expect(collectorUpdater(EMPTY_COLLECTION_FORM).collectedByUserId).toBe("u9");
  });

  it("renders a collector option with and without a role label", () => {
    render(<CollectionFormFields {...common} />);
    expect(screen.getByTestId("opt-with-role").textContent).toContain("Sales Exec");
    expect(screen.getByTestId("opt-no-role").textContent).toContain("Anil");
    expect(screen.getByTestId("opt-no-role").textContent).not.toContain("Sales Exec");
  });
});
