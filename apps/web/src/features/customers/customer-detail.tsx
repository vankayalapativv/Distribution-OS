"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { withQueryClient } from "@/components/data-table/query-provider";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { INFO_TABS } from "./customer-detail-sections";
import { CustomerDetailBodySkeleton } from "./customer-detail-skeleton";
import { getCachedCustomer } from "./customers-cache";
import { CustomerEditDialog } from "./customer-edit-dialog";
import { CustomerStatusDialog } from "./customer-status-dialog";
import { CustomerDetailHeader } from "./customer-detail-header";
import { CustomerDetailTabBar } from "./customer-detail-tabbar";
import { CustomerDetailTabContent } from "./customer-detail-tab-content";
import { buildTabs, type CustomerDetailRole } from "./customer-detail-tabs";
import { useCustomerDetailData } from "./use-customer-detail-data";
import type { Customer } from "./customers-api";

export type { CustomerDetailRole } from "./customer-detail-tabs";

function CustomerDetailInner({
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
  const canEdit = role === "SUPER_ADMIN" || role === "MANAGER";

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

/**
 * Loads the customer client-side: the list seeds a cache on click, so the header
 * (and the Details tab, which renders from the customer) appears instantly while
 * the authoritative fetch revalidates. A direct URL load misses the cache and
 * shows the skeleton until the fetch returns. Keeping the fetch on the client
 * (not blocking the server route) is what lets the header skip the shimmer.
 */
function CustomerDetailLoader({
  customerId,
  role,
  actionConfig,
}: {
  readonly customerId: string;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
}) {
  const query = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => apiGet<Customer>(actionConfig, `/customers/${customerId}`),
    placeholderData: getCachedCustomer(customerId),
    staleTime: 0,
  });

  if (query.data) {
    return <CustomerDetailInner customer={query.data} role={role} actionConfig={actionConfig} />;
  }
  return (
    <DashboardShell role={role} active="customers">
      {query.isError ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          This customer could not be loaded. It may have been removed, or you may not have access.
        </div>
      ) : (
        <CustomerDetailBodySkeleton />
      )}
    </DashboardShell>
  );
}

export const CustomerDetail = withQueryClient(CustomerDetailLoader);
