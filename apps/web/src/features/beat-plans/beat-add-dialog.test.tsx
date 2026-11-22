import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

// Mock the Dialog so the test can drive onOpenChange with both values (Radix only
// ever fires it with `false` for this controlled, trigger-less dialog).
vi.mock("@/components/ui/dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div>
        {children}
        <button onClick={() => onOpenChange(false)}>dlg-close</button>
        <button onClick={() => onOpenChange(true)}>dlg-open</button>
      </div>
    ) : null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogContent: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DialogBody: ({ children }: any) => <div>{children}</div>,
}));

import { BeatAddDialog } from "./beat-add-dialog";

const cust = (id: string, name: string): BeatCustomer => ({
  customerId: id, customerCode: `C-${id}`, legalName: name, tradeName: null, phone: null, city: "Pune",
  segment: null, weekday: null, sequenceNo: 0,
});
const pool = [cust("a", "Acme"), cust("b", "Beta")];
const base = { dayLabel: "Monday", pool, disabled: false, onAdd: vi.fn(), onClose: vi.fn() };

describe("BeatAddDialog", () => {
  it("is closed when open is false", () => {
    render(<BeatAddDialog {...base} open={false} />);
    expect(screen.queryByText("Add to Monday")).not.toBeInTheDocument();
  });

  it("lists the pool, filters by search, and adds a pick", () => {
    const onAdd = vi.fn();
    render(<BeatAddDialog {...base} open onAdd={onAdd} />);
    expect(screen.getByText("Add to Monday")).toBeInTheDocument();
    expect(screen.getByText(/2 unassigned · showing 2/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "beta" } });
    expect(screen.getByText(/showing 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onAdd).toHaveBeenCalledWith("b");
  });

  it("shows a no-match message", () => {
    render(<BeatAddDialog {...base} open />);
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "zzz" } });
    expect(screen.getByText("No matching customers")).toBeInTheDocument();
  });

  it("closes on onOpenChange(false), but an onOpenChange(true) does not close it", () => {
    const onClose = vi.fn();
    render(<BeatAddDialog {...base} open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "dlg-open" })); // o = true → guard skips
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "dlg-close" })); // o = false → clear + close
    expect(onClose).toHaveBeenCalled();
  });
});
