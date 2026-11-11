"use client";

import type { ActionConfig } from "@/lib/api-client";
import { INFO_TABS } from "./customer-detail-sections";
import { CustomerPhotosTab, type CustomerPhoto } from "./customer-photos-tab";
import { CustomerOrdersTab } from "./customer-orders-tab";
import { CustomerLedgerTab } from "./customer-ledger-tab";
import { CustomerVisitsTab } from "./customer-visits-tab";
import { CustomerNotesTab } from "./customer-notes-tab";
import { LEDGER_TAB, NOTES_TAB, ORDERS_TAB, PHOTOS_TAB, VISITS_TAB, type CustomerDetailRole } from "./customer-detail-tabs";
import type { Customer } from "./customers-api";
import type { Order } from "@/features/orders/orders-api";

/** Render the body for the active tab. Info tabs fall through to INFO_TABS. */
export function CustomerDetailTabContent({
  activeTab,
  customer,
  role,
  actionConfig,
  canEdit,
  orders,
  ordersTotal,
  ordersLoading,
  photos,
  photosLoading,
}: {
  readonly activeTab: string;
  readonly customer: Customer;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
  readonly canEdit: boolean;
  readonly orders: Order[];
  readonly ordersTotal: number;
  readonly ordersLoading: boolean;
  readonly photos: CustomerPhoto[];
  readonly photosLoading: boolean;
}) {
  if (activeTab === ORDERS_TAB)
    return (
      <CustomerOrdersTab
        orders={orders}
        total={ordersTotal}
        isLoading={ordersLoading}
        customerId={customer.id}
        customerName={customer.legalName}
        actionConfig={actionConfig}
        canCreateOrder={canEdit}
      />
    );
  if (activeTab === LEDGER_TAB)
    return (
      <CustomerLedgerTab
        customerId={customer.id}
        customerName={customer.legalName}
        role={role}
        actionConfig={actionConfig}
      />
    );
  if (activeTab === NOTES_TAB)
    return <CustomerNotesTab customerId={customer.id} role={role} actionConfig={actionConfig} />;
  if (activeTab === VISITS_TAB)
    return <CustomerVisitsTab customerId={customer.id} actionConfig={actionConfig} />;
  if (activeTab === PHOTOS_TAB)
    return <CustomerPhotosTab photos={photos} isLoading={photosLoading} actionConfig={actionConfig} />;
  return <>{INFO_TABS.find((t) => t.key === activeTab)?.render(customer)}</>;
}
