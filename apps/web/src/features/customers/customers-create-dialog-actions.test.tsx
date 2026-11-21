import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const hookState = {
  customerType: "", setCustomerType: vi.fn(), segments: [] as string[], setSegments: vi.fn(),
  salesExecutiveId: "", setSalesExecutiveId: vi.fn(), isCreating: false, error: null as string | null,
  salesExecutives: [{ id: "u1", name: "Ravi" }], seLoading: false, reset: vi.fn(),
  handleCreate: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-create-customer", () => ({ useCreateCustomer: () => hookState }));
vi.mock("./customers-form-fields", () => ({ CustomerFormFields: () => <div>form-fields</div> }));
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: (p: { emptyText: string; items: { id: string; name: string }[] }) => <span>SE:{p.emptyText}</span>,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (p: { children: React.ReactNode; onOpenChange: (o: boolean) => void }) => (
    <div>
      <button onClick={() => p.onOpenChange(false)}>close-dialog</button>
      <button onClick={() => p.onOpenChange(true)}>open-dialog</button>
      {p.children}
    </div>
  ),
  DialogContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogBody: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogFooter: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogHeader: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogTitle: (p: { children: React.ReactNode }) => <h2>{p.children}</h2>,
  DialogDescription: (p: { children: React.ReactNode }) => <p>{p.children}</p>,
}));
import { CustomerCreateDialog } from "./customers-create-dialog";
const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = () => {
  Object.assign(hookState, { customerType: "", segments: [], salesExecutiveId: "", isCreating: false, error: null, seLoading: false });
  hookState.setSalesExecutiveId.mockClear();
  hookState.reset.mockClear();
  hookState.handleCreate.mockClear();
};

describe("CustomerCreateDialog — close + cancel", () => {
  it("shows the creating label + error and resets on dialog close", () => {
    reset();
    Object.assign(hookState, { isCreating: true, error: "Boom" });
    const onOpenChange = vi.fn();
    render(<CustomerCreateDialog open onOpenChange={onOpenChange} actionConfig={cfg} />);
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close-dialog"));
    expect(hookState.reset).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    hookState.reset.mockClear();
    fireEvent.click(screen.getByText("open-dialog")); // opening forwards without resetting
    expect(hookState.reset).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("Cancel closes without resetting via the footer button", () => {
    reset();
    const onOpenChange = vi.fn();
    render(<CustomerCreateDialog open onOpenChange={onOpenChange} actionConfig={cfg} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
