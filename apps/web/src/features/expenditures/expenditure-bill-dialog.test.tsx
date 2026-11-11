import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Expenditure } from "./expenditures-api";

const blob = { src: null as string | null, isPdf: false, failed: false };
vi.mock("./use-bill-blob", () => ({ useBillBlob: () => blob }));

import { ExpenditureBillDialog } from "./expenditure-bill-dialog";

const entry = (over: Partial<Expenditure> = {}): Expenditure => ({
  id: "e1", expenditureCode: "EXP-1", expenditureDate: "2026-07-18", categoryId: "c1",
  categoryName: "Rent", type: "compulsory", amount: 5000, paymentMode: "cash", paidTo: "Landlord",
  userId: null, userName: null, remarks: null, hasBill: true, createdAt: "2026-07-18T05:00:00Z", ...over,
});
const config = { apiBaseUrl: "", authToken: "" };
const base = { onClose: vi.fn(), actionConfig: config, onEdit: vi.fn(), onDelete: vi.fn() };

afterEach(() => { blob.src = null; blob.isPdf = false; blob.failed = false; });

describe("ExpenditureBillDialog", () => {
  it("renders nothing with no entry", () => {
    render(<ExpenditureBillDialog {...base} entry={null} />);
    expect(screen.queryByText(/Rent/)).not.toBeInTheDocument();
  });

  it("titles with category + amount and shows a loading state, then the image", () => {
    const { rerender } = render(<ExpenditureBillDialog {...base} entry={entry()} />);
    expect(screen.getByText(/Rent · ₹5,000/)).toBeInTheDocument();
    expect(screen.getByText(/paid to Landlord/)).toBeInTheDocument();
    blob.src = "blob:x";
    rerender(<ExpenditureBillDialog {...base} entry={entry()} />);
    expect(screen.getByRole("img", { name: "Bill" })).toBeInTheDocument();
  });

  it("omits the paid-to caption when there is no payee", () => {
    render(<ExpenditureBillDialog {...base} entry={entry({ paidTo: null })} />);
    expect(screen.queryByText(/paid to/)).not.toBeInTheDocument();
  });

  it("shows the PDF in an iframe and the failed message", () => {
    blob.src = "blob:x";
    blob.isPdf = true;
    const { rerender } = render(<ExpenditureBillDialog {...base} entry={entry()} />);
    expect(screen.getByTitle("Bill")).toBeInTheDocument();
    blob.src = null;
    blob.failed = true;
    rerender(<ExpenditureBillDialog {...base} entry={entry()} />);
    expect(screen.getByText(/Couldn't load the bill/)).toBeInTheDocument();
  });

  it("wires Edit and Delete", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const e = entry();
    render(<ExpenditureBillDialog {...base} entry={e} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(e);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(e);
  });
});
