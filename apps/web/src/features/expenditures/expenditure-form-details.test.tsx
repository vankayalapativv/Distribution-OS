import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormState } from "./use-expenditure-form";

vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogSection: ({ children }: any) => <div>{children}</div>,
}));
const sels: Array<(v: string) => void> = [];
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: ({ items, valueKey, getKey, getLabel, onSelect }: {
    readonly items: unknown[];
    readonly valueKey: string;
    readonly getKey: (it: unknown) => string;
    readonly getLabel: (it: unknown) => string;
    readonly onSelect: (v: string) => void;
  }) => {
    sels.push(onSelect);
    const selected = items.find((it) => getKey(it) === valueKey);
    return <div>{selected ? getLabel(selected) : null}</div>;
  },
}));

import { ExpenditureFormDetails } from "./expenditure-form-details";

const form = (over: Partial<FormState> = {}): FormState => ({
  expenditureDate: "", categoryId: "", amount: "", paymentMode: "", paidTo: "", userId: "", remarks: "", ...over,
});
const people = [{ id: "u1", name: "Asha" }];

describe("ExpenditureFormDetails", () => {
  it("edits payment mode, paid-to and the person link", () => {
    sels.length = 0;
    const set = vi.fn();
    render(<ExpenditureFormDetails form={form()} set={set} people={people} />);
    sels[0]("upi"); // payment mode select
    expect(set).toHaveBeenCalledWith("paymentMode", "upi");
    fireEvent.change(screen.getByLabelText("Paid to"), { target: { value: "Vendor" } });
    expect(set).toHaveBeenCalledWith("paidTo", "Vendor");
    sels[1]("u1"); // person select
    expect(set).toHaveBeenCalledWith("userId", "u1");
  });

  it("shows the selected person's name in the trigger", () => {
    sels.length = 0;
    render(<ExpenditureFormDetails form={form({ userId: "u1" })} set={vi.fn()} people={people} />);
    expect(screen.getAllByText("Asha").length).toBeGreaterThan(0);
  });
});
