"use client";

import { useState } from "react";
import { type ActionConfig } from "@/lib/api-client";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { useCan } from "@/features/shell/use-can";
import { INFO_TABS } from "./customer-detail-sections";
import { CustomerEditDialog } from "./customer-edit-dialog";
import { CustomerStatusDialog } from "./customer-status-dialog";
import { CustomerDetailHeader } from "./customer-detail-header";
import { CustomerDetailTabBar } from "./customer-detail-tabbar";
import { CustomerDetailTabContent } from "./customer-detail-tab-content";
import { buildTabs, type CustomerDetailRole } from "./customer-detail-tabs";
import { useCustomerDetailData } from "./use-customer-detail-data";
import type { Customer } from "./customers-api";

export function CustomerDetailInner({
  customer: initial,
  role,
  actionConfig,
}: {
  readonly customer: Customer;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
}) {
  // `initial` is the loader's data: the list-seeded placeholder first, then the
  // fresh fetch. Derive from it (not local state) so that swap flows through;
  // an edit/status save holds its result in `override`.
  const [override, setOverride] = useState<Customer | null>(null);
  const customer = override ?? initial;
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(INFO_TABS[0].key);
  const canEdit = useCan("action:customers.edit");
  const canCreateOrder = useCan("action:orders.create");

  const d = useCustomerDetailData(customer.id, actionConfig);
  const tabs = buildTabs({
    ordersTotal: d.ordersTotal,
    ordersLoading: d.ordersLoading,
    visitsCount: d.visitsCount,
    visitsLoading: d.visitsLoading,
    photosCount: d.photos.length,
    photosLoading: d.photosLoading,
    notesCount: d.notesCount,
    notesLoading: d.notesLoading,
  });

  return (
    <>
      <DashboardShell role={role} active="customers">
        <CustomerDetailHeader
          customer={customer}
          canEdit={canEdit}
          onEdit={() => setEditOpen(true)}
          onStatus={() => setStatusOpen(true)}
          actionConfig={actionConfig}
        />

        <CustomerDetailTabBar tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />

        <div className="pt-1">
          <CustomerDetailTabContent
            activeTab={activeTab}
            customer={customer}
            role={role}
            actionConfig={actionConfig}
            canCreateOrder={canCreateOrder}
            orders={d.orders}
            ordersTotal={d.ordersTotal}
            ordersLoading={d.ordersLoading}
            photos={d.photos}
            photosLoading={d.photosLoading}
          />
        </div>
      </DashboardShell>

      {canEdit && (
        <>
          <CustomerEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            customer={customer}
            actionConfig={actionConfig}
            onUpdated={setOverride}
          />
          <CustomerStatusDialog
            open={statusOpen}
            onOpenChange={setStatusOpen}
            customer={customer}
            actionConfig={actionConfig}
            onUpdated={setOverride}
          />
        </>
      )}
    </>
  );
}
