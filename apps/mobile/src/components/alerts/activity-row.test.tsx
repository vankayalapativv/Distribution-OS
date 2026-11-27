import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActivityRow } from "./activity-row";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

const notif = (over: Partial<InvoiceNotification> = {}): InvoiceNotification => ({
  id: "a1",
  type: "admin_order",
  title: "New order",
  body: "ORD-1 placed",
  invoiceId: null,
  customerId: null,
  createdAt: "2026-11-27T09:00:00Z",
  readAt: null,
  ...over,
});

describe("ActivityRow", () => {
  it("renders an unread known-type row with title/body and fires onPress + onDelete", () => {
    const onPress = vi.fn();
    const onDelete = vi.fn();
    render(<ActivityRow n={notif()} onPress={onPress} onDelete={onDelete} />);
    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.getByText("ORD-1 placed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("New order"));
    expect(onPress).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Delete alert"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("falls back to a default icon for an unknown type, drops the body, and hides the delete button", () => {
    render(<ActivityRow n={notif({ type: "mystery", body: null, readAt: "2026-11-27T10:00:00Z" })} onPress={() => {}} />);
    expect(screen.getByText("New order")).toBeInTheDocument();
    expect(screen.queryByText("ORD-1 placed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete alert")).not.toBeInTheDocument();
  });
});
