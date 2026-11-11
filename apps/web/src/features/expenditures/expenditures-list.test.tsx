import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


const s = {
  isLoading: false, total: 3, error: null as { message: string } | null,
  from: "a", to: "b", categories: [], people: [], columns: [1, 2],
  table: {}, pageSize: 8, pageCount: 1, showSkeleton: false, hasFilters: false,
  setCategoryOpen: vi.fn(), openNew: vi.fn(), setBillFor: vi.fn(), handleEdit: vi.fn(),
  setDeleting: vi.fn(), setFormOpen: vi.fn(), setEditing: vi.fn(), confirmDelete: vi.fn(),
  formOpen: false, editing: null, categoryOpen: false, billFor: null, deleting: null,
};
vi.mock("./use-expenditures-list", () => ({ useExpendituresList: () => s }));
vi.mock("@/components/data-table/query-provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withQueryClient: (C: any) => C,
}));
vi.mock("@/features/shell/dashboard-shell", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DashboardShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/page-header", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageHeader: ({ subtitle, action }: any) => <div>{subtitle}{action}</div>,
}));
vi.mock("./expenditure-summary", () => ({ ExpenditureSummaryPanel: () => <div>SUMMARY</div> }));
vi.mock("./expenditure-filters", () => ({ ExpenditureFilters: () => <div>FILTERS</div> }));
vi.mock("./expenditure-form-dialog", () => ({ ExpenditureFormDialog: () => <div>FORM</div> }));
vi.mock("./expenditure-category-dialog", () => ({ ExpenditureCategoryDialog: () => <div>CATEGORY</div> }));
vi.mock("./expenditure-bill-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExpenditureBillDialog: ({ onClose, onEdit, onDelete }: any) => (
    <div>BILL<button onClick={onClose}>b-close</button><button onClick={() => onEdit({ id: "x" })}>b-edit</button><button onClick={() => onDelete({ id: "x" })}>b-del</button></div>
  ),
}));
vi.mock("./expenditure-delete-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExpenditureDeleteDialog: ({ onOpenChange }: any) => <div>DELETE<button onClick={() => onOpenChange(false)}>d-close</button></div>,
}));
vi.mock("@/components/data-table/data-table", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTable: ({ empty, onRowClick }: any) => <div><button onClick={() => onRowClick({ id: "e1", hasBill: true })}>row-bill</button><button onClick={() => onRowClick({ id: "e2", hasBill: false })}>row-edit</button>{empty}</div>,
}));

import { ExpendituresList } from "./expenditures-list";

const config = { apiBaseUrl: "", authToken: "" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => { s.error = null; });

describe("ExpendituresList", () => {
  it("renders the chrome + all sections and wires the header buttons", () => {
    render(<ExpendituresList role="ACCOUNTANT" actionConfig={config} />);
    expect(screen.getByText(/3 entries in this period/)).toBeInTheDocument();
    for (const t of ["SUMMARY", "FILTERS", "FORM", "CATEGORY", "BILL", "DELETE"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "+ Category" }));
    expect(s.setCategoryOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "+ Record Expenditure" }));
    expect(s.openNew).toHaveBeenCalled();
  });

  it("row click opens the bill when there's one, else edits", () => {
    render(<ExpendituresList role="SUPER_ADMIN" actionConfig={config} />);
    fireEvent.click(screen.getByText("row-bill"));
    expect(s.setBillFor).toHaveBeenCalledWith({ id: "e1", hasBill: true });
    fireEvent.click(screen.getByText("row-edit"));
    expect(s.handleEdit).toHaveBeenCalledWith({ id: "e2", hasBill: false });
  });

  it("the bill dialog's edit/delete close the bill then act; delete-dialog closes", () => {
    render(<ExpendituresList role="SUPER_ADMIN" actionConfig={config} />);
    fireEvent.click(screen.getByText("b-close"));
    expect(s.setBillFor).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("b-edit"));
    expect(s.handleEdit).toHaveBeenCalledWith({ id: "x" });
    fireEvent.click(screen.getByText("b-del"));
    expect(s.setDeleting).toHaveBeenCalledWith({ id: "x" });
    fireEvent.click(screen.getByText("d-close"));
    expect(s.setDeleting).toHaveBeenCalledWith(null);
  });

  it("shows a table error", () => {
    s.error = { message: "Boom" };
    render(<ExpendituresList role="MANAGER" actionConfig={config} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
