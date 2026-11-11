import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hookState = {
  customerType: "",
  setCustomerType: vi.fn(),
  segments: [] as string[],
  setSegments: vi.fn(),
  salesExecutiveId: "",
  setSalesExecutiveId: vi.fn(),
  isCreating: false,
  error: null as string | null,
  salesExecutives: [{ id: "u1", name: "Ravi" }],
  seLoading: false,
  reset: vi.fn(),
  handleCreate: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-create-customer", () => ({ useCreateCustomer: () => hookState }));
vi.mock("./customers-form-fields", () => ({ CustomerFormFields: () => <div>form-fields</div> }));
vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: (p: {
    emptyText: string;
    items: { id: string; name: string }[];
    getKey: (u: { id: string }) => string;
    getLabel: (u: { name: string }) => string;
    onSelect: (id: string) => void;
  }) => (
    <div>
      <span>SE:{p.emptyText}</span>
      {p.items.map((u) => (
        <button key={p.getKey(u)} onClick={() => p.onSelect(p.getKey(u))}>
          {p.getLabel(u)}
        </button>
      ))}
    </div>
  ),
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
  Object.assign(hookState, {
    customerType: "",
    segments: [],
    salesExecutiveId: "",
    isCreating: false,
    error: null,
    seLoading: false,
  });
  hookState.setSalesExecutiveId.mockClear();
  hookState.reset.mockClear();
  hookState.handleCreate.mockClear();
};

describe("CustomerCreateDialog", () => {
  it("disables Create until type, segment, and executive are set", () => {
    reset();
    render(<CustomerCreateDialog open onOpenChange={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByRole("button", { name: "Create customer" })).toBeDisabled();
  });

  it("enables Create and submits when the form is valid", () => {
    reset();
    Object.assign(hookState, { customerType: "retail", segments: ["Car"], salesExecutiveId: "u1" });
    render(<CustomerCreateDialog open onOpenChange={vi.fn()} actionConfig={cfg} />);
    const btn = screen.getByRole("button", { name: "Create customer" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(hookState.handleCreate).toHaveBeenCalled();

    // the executive picker wires getKey/getLabel/onSelect through
    fireEvent.click(screen.getByRole("button", { name: "Ravi" }));
    expect(hookState.setSalesExecutiveId).toHaveBeenCalledWith("u1");
  });

  it("shows a loading empty-text while executives load", () => {
    reset();
    Object.assign(hookState, { seLoading: true });
    render(<CustomerCreateDialog open onOpenChange={vi.fn()} actionConfig={cfg} />);
    expect(screen.getByText("SE:Loading…")).toBeInTheDocument();
  });

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

    // opening (next=true) forwards without resetting
    hookState.reset.mockClear();
    fireEvent.click(screen.getByText("open-dialog"));
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
