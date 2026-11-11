import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the date/select widgets so we can drive their onChange deterministically.
vi.mock("@/features/expenditures/expenditure-date-picker", () => ({
  DatePicker: ({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) => (
    <button data-testid="date" data-value={value} onClick={() => onChange("2026-09-20")}>date</button>
  ),
}));
vi.mock("@/components/ui/search-select", () => ({
  SearchSelect: ({ valueKey, onSelect }: { readonly valueKey: string; readonly onSelect: (v: string) => void }) => (
    <button data-testid="mode" data-value={valueKey} onClick={() => onSelect("cheque")}>mode</button>
  ),
}));

import { CollectionPaymentFields } from "./collection-payment-fields";
import { EMPTY_COLLECTION_FORM, type CollectionForm } from "./collection-form-types";

/** Stateful harness so controlled inputs reflect typing (avoids React resetting
 *  the DOM value back when `setForm` is a no-op spy). */
function renderFields(over: Partial<CollectionForm> = {}) {
  function Harness() {
    const [form, setForm] = useState<CollectionForm>({ ...EMPTY_COLLECTION_FORM, ...over });
    return <CollectionPaymentFields form={form} setForm={setForm} />;
  }
  render(<Harness />);
}

describe("CollectionPaymentFields", () => {
  it("hides cheque fields unless the mode is cheque", () => {
    renderFields({ paymentMode: "cash" });
    expect(screen.queryByText("Cheque Date")).not.toBeInTheDocument();
    expect(screen.queryByText("Bank Name")).not.toBeInTheDocument();
  });

  it("shows cheque date + bank when the mode is cheque", () => {
    renderFields({ paymentMode: "cheque" });
    expect(screen.getByText("Cheque Date")).toBeInTheDocument();
    expect(screen.getByText("Bank Name")).toBeInTheDocument();
  });

  it("updates the amount", () => {
    renderFields();
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "1200" } });
    expect(input).toHaveValue(1200);
  });

  it("updates the reference number", () => {
    renderFields();
    const input = screen.getByPlaceholderText("UTR / cheque / txn no.");
    fireEvent.change(input, { target: { value: "UTR55" } });
    expect(input).toHaveValue("UTR55");
  });

  it("updates the bank name in cheque mode", () => {
    renderFields({ paymentMode: "cheque" });
    const input = screen.getByPlaceholderText("e.g. SBI");
    fireEvent.change(input, { target: { value: "HDFC" } });
    expect(input).toHaveValue("HDFC");
  });

  it("switching mode to cheque via the select reveals the cheque fields", () => {
    renderFields({ paymentMode: "cash" });
    expect(screen.queryByText("Cheque Date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mode")); // onChange -> "cheque"
    expect(screen.getByText("Cheque Date")).toBeInTheDocument();
  });

  it("sets the collection date via the date picker", () => {
    renderFields();
    fireEvent.click(screen.getAllByTestId("date")[0]);
    expect(screen.getAllByTestId("date")[0]).toHaveAttribute("data-value", "2026-09-20");
  });

  it("sets the cheque date via its own picker in cheque mode", () => {
    renderFields({ paymentMode: "cheque" });
    const dates = screen.getAllByTestId("date"); // [collection, cheque]
    fireEvent.click(dates[1]);
    expect(dates[1]).toHaveAttribute("data-value", "2026-09-20");
  });
});
