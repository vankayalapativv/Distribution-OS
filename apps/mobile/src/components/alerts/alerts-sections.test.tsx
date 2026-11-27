import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AlertsSections } from "./alerts-sections";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

const notif = (id: string, over: Partial<InvoiceNotification> = {}): InvoiceNotification => ({
  id,
  type: "invoice",
  title: `Alert ${id}`,
  body: null,
  invoiceId: null,
  customerId: "c1",
  createdAt: "2026-11-27T09:00:00Z",
  readAt: null,
  ...over,
});

const base = {
  loading: false,
  dues: [notif("d1")],
  invoices: [notif("i1")],
  deliveries: [notif("x1")],
  refreshing: false,
  onRefresh: () => {},
  onDues: vi.fn(),
  onOpen: vi.fn(),
  markRead: vi.fn(),
  deleteOne: vi.fn(),
};

describe("AlertsSections", () => {
  it("shows the skeleton while loading", () => {
    const { container } = render(<AlertsSections {...base} tab="dues" loading />);
    expect(container.querySelector("div")).not.toBeNull();
    expect(screen.queryByText("Alert d1")).not.toBeInTheDocument();
  });

  it("renders the active tab's cards and wires press + delete", () => {
    const onDues = vi.fn();
    const deleteOne = vi.fn();
    render(<AlertsSections {...base} tab="dues" onDues={onDues} deleteOne={deleteOne} />);
    expect(screen.getByText("Alert d1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Alert d1"));
    expect(onDues).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("trash-outline"));
    expect(deleteOne).toHaveBeenCalledWith("d1");
  });

  it("switches to the invoice tab's data", () => {
    render(<AlertsSections {...base} tab="invoice" />);
    expect(screen.getByText("Alert i1")).toBeInTheDocument();
    expect(screen.queryByText("Alert d1")).not.toBeInTheDocument();
  });

  it("shows the empty state for a tab with no items", () => {
    render(<AlertsSections {...base} tab="delivery" deliveries={[]} />);
    expect(screen.getByText("No deliveries yet")).toBeInTheDocument();
  });
});
