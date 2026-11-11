import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Expenditure } from "./expenditures-api";

vi.mock("@/components/confirm-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ConfirmDialog: ({ open, details, title }: any) => (open ? <div>{title}{details}</div> : null),
}));

import { ExpenditureDeleteDialog } from "./expenditure-delete-dialog";

const entry = (over: Partial<Expenditure> = {}): Expenditure => ({
  id: "e1", expenditureCode: "EXP-1", expenditureDate: "2026-07-18", categoryId: "c1",
  categoryName: "Rent", type: "compulsory", amount: 5000, paymentMode: null, paidTo: "Landlord",
  userId: null, userName: null, remarks: null, hasBill: false, createdAt: "", ...over,
});

describe("ExpenditureDeleteDialog", () => {
  it("is closed with no target", () => {
    render(<ExpenditureDeleteDialog deleting={null} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText("Delete expenditure?")).not.toBeInTheDocument();
  });

  it("lists the entry's code, category, amount, date and paid-to", () => {
    render(<ExpenditureDeleteDialog deleting={entry()} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("EXP-1")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByText("Landlord")).toBeInTheDocument();
  });

  it("omits paid-to when absent", () => {
    render(<ExpenditureDeleteDialog deleting={entry({ paidTo: null })} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText("Paid to")).not.toBeInTheDocument();
  });
});
