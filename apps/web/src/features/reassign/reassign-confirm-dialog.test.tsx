/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogBody: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import { ReassignConfirmDialog } from "./reassign-confirm-dialog";

const COUNTS = { orders: 24, collections: 11, invoices: 23, visits: 38, photos: 9, notes: 5, beatDays: 2 };
const base = {
  open: true,
  onOpenChange: vi.fn(),
  customerName: "Balaji Auto",
  fromName: "Priya",
  toName: "Vishnu",
  counts: COUNTS,
  busy: false,
  onConfirm: vi.fn(),
};

describe("ReassignConfirmDialog", () => {
  it("shows the breakdown and gates Confirm behind the acknowledgement", () => {
    const onConfirm = vi.fn();
    render(<ReassignConfirmDialog {...base} onConfirm={onConfirm} />);
    expect(screen.getByRole("heading", { name: /Move Balaji Auto\?/ })).toBeInTheDocument();
    expect(screen.getByText(/112 total/)).toBeInTheDocument();
    expect(screen.getByText("Beat days")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Confirm move" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("Cancel closes it, and the acknowledgement resets when the dialog closes", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ReassignConfirmDialog {...base} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Close then reopen → the checkbox is reset (render-phase reset).
    rerender(<ReassignConfirmDialog {...base} open={false} onOpenChange={onOpenChange} />);
    rerender(<ReassignConfirmDialog {...base} open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows the busy label and falls back when no target name is set", () => {
    render(<ReassignConfirmDialog {...base} toName="" busy />);
    expect(screen.getByRole("button", { name: "Moving…" })).toBeInTheDocument();
    expect(screen.getByText(/the selected executive/)).toBeInTheDocument();
  });
});
