import type { ReactNode } from "react";
import { Icon } from "../icon";
import type { InvoiceNotification } from "../../lib/invoice-notifications";

export interface TabConfig {
  items: InvoiceNotification[];
  accent: string;
  emptyTitle: string;
  emptyBody: string;
  skeletonCount: number;
  trailing: (n: InvoiceNotification) => ReactNode;
  onPress: (n: InvoiceNotification) => void;
}

/** Per-tab presentation + data + handlers for {@link AlertsSections}. Kept out
 *  of the list component so the segment definitions read as one table. */
export function buildTabConfig({
  dues,
  invoices,
  deliveries,
  onDues,
  onOpen,
  markRead,
}: {
  dues: InvoiceNotification[];
  invoices: InvoiceNotification[];
  deliveries: InvoiceNotification[];
  onDues: (n: InvoiceNotification) => void;
  onOpen: (n: InvoiceNotification) => void;
  markRead: (n: InvoiceNotification) => void;
}): Record<"dues" | "invoice" | "delivery", TabConfig> {
  return {
    dues: {
      items: dues,
      accent: "border-red-200 bg-red-50",
      emptyTitle: "Nothing due yet",
      emptyBody: "Customers moving into an older dues bucket will appear here.",
      skeletonCount: 2,
      trailing: (n) =>
        n.customerId ? <Icon name="chevron-forward-outline" size={20} color="#ef4444" /> : undefined,
      onPress: onDues,
    },
    invoice: {
      items: invoices,
      accent: "border-blue-200 bg-blue-50",
      emptyTitle: "No new invoices",
      emptyBody:
        "Invoices uploaded for your customers will appear here, ready to view and share on WhatsApp.",
      skeletonCount: 3,
      trailing: () => <Icon name="chevron-forward-outline" size={20} color="#3b82f6" />,
      onPress: onOpen,
    },
    delivery: {
      items: deliveries,
      accent: "border-green-200 bg-green-50",
      emptyTitle: "No deliveries yet",
      emptyBody: "When an order is delivered to one of your customers, it'll show up here.",
      skeletonCount: 2,
      trailing: () => <Icon name="checkmark-circle-outline" size={20} color="#16a34a" />,
      onPress: markRead,
    },
  };
}
