import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenditureCategory } from "./expenditures-api";
import type { FormState } from "./use-expenditure-form";

vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogSection: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("./expenditure-date-picker", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DatePicker: ({ onChange }: any) => <button onClick={() => onChange("2026-07-20")}>date</button>,
}));
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: ({ items, getKey, getLabel, onSelect, renderOption }: {
    readonly items: unknown[];
    readonly getKey: (it: unknown) => string;
    readonly getLabel: (it: unknown) => string;
    readonly onSelect: (v: string) => void;
    readonly renderOption?: (it: unknown) => ReactNode;
  }) => (
    <div>
      {items.map((it) => (
        <button key={getKey(it)} onClick={() => onSelect(getKey(it))}>
          {renderOption ? renderOption(it) : getLabel(it)}
        </button>
      ))}
    </div>
  ),
}));

import { ExpenditureFormSpend } from "./expenditure-form-spend";

const form = (over: Partial<FormState> = {}): FormState => ({
  expenditureDate: "2026-07-18", categoryId: "", amount: "", paymentMode: "", paidTo: "", userId: "", remarks: "", ...over,
});
const categories: ExpenditureCategory[] = [
  { id: "c1", name: "Rent", type: "compulsory", isSystem: true, isActive: true },
  { id: "v1", name: "Fuel", type: "variable", isSystem: true, isActive: true },
];

describe("ExpenditureFormSpend", () => {
  it("lists categories with their type tag and reports a pick + date + amount edits", () => {
    const set = vi.fn();
    render(<ExpenditureFormSpend form={form()} set={set} categories={categories} />);
    // Each option carries a Compulsory/Variable tag (searchable flat list).
    expect(screen.getByText("Compulsory")).toBeInTheDocument();
    expect(screen.getByText("Variable")).toBeInTheDocument();
    fireEvent.click(screen.getByText("date"));
    expect(set).toHaveBeenCalledWith("expenditureDate", "2026-07-20");
    fireEvent.change(screen.getByLabelText("Amount (₹)"), { target: { value: "500" } });
    expect(set).toHaveBeenCalledWith("amount", "500");
    fireEvent.click(screen.getByText("Fuel"));
    expect(set).toHaveBeenCalledWith("categoryId", "v1");
  });

  it("shows the compulsory/variable hint for the selected category", () => {
    render(<ExpenditureFormSpend form={form({ categoryId: "c1" })} set={vi.fn()} categories={categories} />);
    expect(screen.getByText("Compulsory expenditure")).toBeInTheDocument();
  });
});
