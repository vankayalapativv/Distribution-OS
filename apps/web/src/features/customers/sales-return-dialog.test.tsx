import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hook = {
  invoiceId: "inv1",
  date: "2026-07-01",
  setDate: vi.fn(),
  qty: {},
  setQty: vi.fn(),
  reason: "",
  setReason: vi.fn(),
  proofFile: null,
  setProofFile: vi.fn(),
  busy: false,
  error: null,
  invoicesQ: {},
  returnableQ: {},
  lines: [{}],
  outstanding: 500,
  total: 100,
  overCap: false,
  reset: vi.fn(),
  pickInvoice: vi.fn(),
  handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
};
vi.mock("./use-sales-return", () => ({ useSalesReturn: () => hook }));
vi.mock("./sales-return-fields", () => ({ SalesReturnFields: () => <div>fields</div> }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: (p: { children: React.ReactNode; onOpenChange: (o: boolean) => void }) => (
    <div>
      <button onClick={() => p.onOpenChange(false)}>dlg-close</button>
      <button onClick={() => p.onOpenChange(true)}>dlg-open</button>
      {p.children}
    </div>
  ),
  DialogContent: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogBody: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogFooter: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogHeader: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  DialogTitle: (p: { children: React.ReactNode }) => <h2>{p.children}</h2>,
}));

import { SalesReturnDialog } from "./sales-return-dialog";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const reset = (over: Partial<typeof hook> = {}) => {
  Object.assign(hook, { busy: false, invoiceId: "inv1", total: 100, overCap: false }, over);
  hook.handleSubmit.mockClear();
  hook.reset.mockClear();
};

describe("SalesReturnDialog", () => {
  it("shows the customer title, the fields, and submits", () => {
    reset();
    render(<SalesReturnDialog open onOpenChange={vi.fn()} customerId="c1" customerName="Raj Motors" actionConfig={cfg} onCreated={vi.fn()} />);
    expect(screen.getByText("New sales return — Raj Motors")).toBeInTheDocument();
    expect(screen.getByText("fields")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Record return" }).closest("form")!);
    expect(hook.handleSubmit).toHaveBeenCalled();
  });

  it("disables Record while busy and cancels", () => {
    reset({ busy: true });
    const onOpenChange = vi.fn();
    render(<SalesReturnDialog open onOpenChange={onOpenChange} customerId="c1" customerName="Raj" actionConfig={cfg} />);
    expect(screen.getByRole("button", { name: "Recording…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets on dialog close but not on open", () => {
    reset();
    const onOpenChange = vi.fn();
    render(<SalesReturnDialog open onOpenChange={onOpenChange} customerId="c1" customerName="Raj" actionConfig={cfg} />);
    fireEvent.click(screen.getByText("dlg-close"));
    expect(hook.reset).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    hook.reset.mockClear();
    fireEvent.click(screen.getByText("dlg-open"));
    expect(hook.reset).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
