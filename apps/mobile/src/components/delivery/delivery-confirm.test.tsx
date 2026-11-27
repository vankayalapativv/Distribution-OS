import { describe, expect, it, vi } from "vitest";
vi.mock("../../lib/deliverable-invoice", () => ({ addressLine: (inv: { address?: string }) => inv.address ?? "" }));

import { fireEvent, render, screen } from "@testing-library/react";
import { DeliveryConfirm } from "./delivery-confirm";

const invoiceData = { id: "i1", invoiceNumber: "INV-1", customerName: "Acme", customerCode: "C1", address: "MG Road" };
const invoice = invoiceData as never;

const base = {
  invoice,
  photos: [{ uri: "file:///a.jpg" }] as never,
  stamping: false,
  busy: false,
  error: null as string | null,
  onBack: vi.fn(),
  onAddPhoto: vi.fn(),
  onRemovePhoto: vi.fn(),
  onSave: vi.fn(),
};

describe("DeliveryConfirm", () => {
  it("renders the invoice, a photo tile (view/remove), and saves", () => {
    const onRemovePhoto = vi.fn();
    const onSave = vi.fn();
    const onBack = vi.fn();
    const { container } = render(<DeliveryConfirm {...base} onRemovePhoto={onRemovePhoto} onSave={onSave} onBack={onBack} />);
    expect(screen.getByText("INV-1")).toBeInTheDocument();
    expect(screen.getByText("MG Road")).toBeInTheDocument();
    fireEvent.click(container.querySelector("img") as Element); // open the viewer
    fireEvent.click(screen.getByLabelText("close")); // close it
    fireEvent.click(screen.getByText("✕")); // remove photo 0
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByText("Save delivery"));
    expect(onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByText("‹"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the stamping shimmer + an error, and the busy spinner on save", () => {
    const { rerender } = render(<DeliveryConfirm {...base} stamping error="Save failed" />);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    rerender(<DeliveryConfirm {...base} busy />);
    expect(screen.queryByText("Save delivery")).not.toBeInTheDocument(); // replaced by spinner
  });

  it("falls back for a missing customer name / code / address", () => {
    render(<DeliveryConfirm {...base} invoice={{ ...invoiceData, customerName: null, customerCode: null, address: "" } as never} />);
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });
});
