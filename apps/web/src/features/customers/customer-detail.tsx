"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { withQueryClient } from "@/components/data-table/query-provider";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { CustomerDetailBodySkeleton } from "./customer-detail-skeleton";
import { getCachedCustomer } from "./customers-cache";
import { CustomerDetailInner } from "./customer-detail-inner";
import { type CustomerDetailRole } from "./customer-detail-tabs";
import type { Customer } from "./customers-api";

export type { CustomerDetailRole } from "./customer-detail-tabs";

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
