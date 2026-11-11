"use client";

import { useState } from "react";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { withQueryClient } from "@/components/data-table/query-provider";
import { type ActionConfig } from "@/lib/api-client";
import { INFO_TABS } from "./customer-detail-sections";
import { CustomerEditDialog } from "./customer-edit-dialog";
import { CustomerStatusDialog } from "./customer-status-dialog";
import { CustomerDetailHeader } from "./customer-detail-header";
import { CustomerDetailTabBar } from "./customer-detail-tabbar";
import { CustomerDetailTabContent } from "./customer-detail-tab-content";
import { buildTabs, type CustomerDetailRole } from "./customer-detail-tabs";
import { useCustomerDetailData } from "./use-customer-detail-data";
import type { Customer } from "./customers-api";

export type { CustomerDetailRole } from "./customer-detail-tabs";

interface CustomerDetailProps {
  readonly customer: Customer;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
}

function CustomerDetailInner({ customer: initial, role, actionConfig }: CustomerDetailProps) {
  const [customer, setCustomer] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(INFO_TABS[0].key);
  const canEdit = role === "SUPER_ADMIN" || role === "MANAGER";

  const d = useCustomerDetailData(customer.id, actionConfig);
  const tabs = buildTabs({
    ordersTotal: d.ordersTotal,
    ordersLoading: d.ordersLoading,
    visitsCount: d.visitsCount,
    visitsLoading: d.visitsLoading,
    photosCount: d.photos.length,
    photosLoading: d.photosLoading,
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
            canEdit={canEdit}
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
            onUpdated={setCustomer}
          />
          <CustomerStatusDialog
            open={statusOpen}
            onOpenChange={setStatusOpen}
            customer={customer}
            actionConfig={actionConfig}
            onUpdated={setCustomer}
          />
        </>
      )}
    </>
  );
}

export const CustomerDetail = withQueryClient(CustomerDetailInner);
