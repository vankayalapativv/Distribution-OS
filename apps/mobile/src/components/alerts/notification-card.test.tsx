import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationCard } from "./notification-card";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

const notif = (over: Partial<InvoiceNotification> = {}): InvoiceNotification => ({
  id: "n1",
  type: "invoice",
  title: "New invoice INV-1",
  body: "₹5,000 due",
  invoiceId: "i1",
  customerId: "c1",
  createdAt: "2026-11-27T09:00:00Z",
  readAt: null,
  ...over,
});

describe("NotificationCard", () => {
  it("renders an unread card with title, body, time + new marker, and fires onPress", () => {
    const onPress = vi.fn();
    render(
      <NotificationCard n={notif()} accent="bg-blue-50" trailing={<Text>›</Text>} onPress={onPress} onDelete={() => {}} />,
    );
    expect(screen.getByText("New invoice INV-1")).toBeInTheDocument();
    expect(screen.getByText("₹5,000 due")).toBeInTheDocument();
    expect(screen.getByText(/new/)).toBeInTheDocument(); // unread marker
    fireEvent.click(screen.getByText("New invoice INV-1"));
    expect(onPress).toHaveBeenCalled();
  });

  it("drops the new marker + body when read/empty, and fires onDelete", () => {
    const onDelete = vi.fn();
    render(
      <NotificationCard
        n={notif({ readAt: "2026-11-27T10:00:00Z", body: null })}
        accent="bg-blue-50"
        onPress={() => {}}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText(/· new/)).not.toBeInTheDocument();
    expect(screen.queryByText("₹5,000 due")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("trash-outline"));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });
});
