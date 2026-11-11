import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildExpenditureColumns, expenditureSkeleton } from "./expenditures-columns";
import type { Expenditure } from "./expenditures-api";

const entry = (over: Partial<Expenditure> = {}): Expenditure => ({
  id: "e1", expenditureCode: "EXP-1", expenditureDate: "2026-07-18", categoryId: "c1",
  categoryName: "Rent", type: "compulsory", amount: 5000, paymentMode: "upi", paidTo: "Landlord",
  userId: "u1", userName: "Asha", remarks: null, hasBill: false, createdAt: "", ...over,
});
const cols = buildExpenditureColumns({ onEdit: vi.fn(), onDelete: vi.fn() });
type CellFn = (ctx: { row: { original: Expenditure }; getValue: () => unknown }) => React.ReactNode;
const byId = (id: string) => cols.find((c) => (c as { id?: string; accessorKey?: string }).id === id || (c as { accessorKey?: string }).accessorKey === id)!;
const renderCell = (id: string, e: Expenditure) => {
  const { cell } = byId(id) as { cell: CellFn; accessorKey?: keyof Expenditure };
  const key = (byId(id) as { accessorKey?: keyof Expenditure }).accessorKey;
  return render(<>{cell({ row: { original: e }, getValue: () => (key ? e[key] : undefined) })}</>);
};

describe("buildExpenditureColumns", () => {
  it("adds an actions column and a matching skeleton", () => {
    expect(cols.at(-1)!.id).toBe("actions");
    expect(cols.length).toBe(expenditureSkeleton.length);
  });

  it("renders code, date, category, type, for, mode and amount cells", () => {
    renderCell("expenditureCode", entry());
    expect(screen.getByText("EXP-1")).toBeInTheDocument();
    renderCell("categoryName", entry());
    expect(screen.getByText("Rent")).toBeInTheDocument();
    renderCell("type", entry());
    expect(screen.getByText("compulsory")).toBeInTheDocument();
    renderCell("userName", entry());
    expect(screen.getByText("Asha")).toBeInTheDocument();
    renderCell("paymentMode", entry());
    expect(screen.getByText("UPI")).toBeInTheDocument();
    renderCell("amount", entry());
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("dashes an empty 'For'", () => {
    renderCell("userName", entry({ userName: null }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the date cell and the actions cell", () => {
    renderCell("expenditureDate", entry());
    expect(screen.getByText(/2026|Jul/)).toBeInTheDocument();
    renderCell("actions", entry());
    expect(screen.getByRole("button", { name: "Edit EXP-1" })).toBeInTheDocument();
  });

  it("renders every skeleton cell", () => {
    expect(expenditureSkeleton.length).toBeGreaterThan(0);
    expenditureSkeleton.forEach((c) => {
      const { container, unmount } = render(<>{c()}</>);
      expect(container.firstChild).not.toBeNull();
      unmount();
    });
  });
});
