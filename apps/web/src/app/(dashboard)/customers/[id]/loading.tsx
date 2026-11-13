import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { DashboardRole } from "@/features/shell/dashboard-nav";
import { CustomerDetailBodySkeleton } from "../../../../features/customers/customer-detail-skeleton";
import { getSessionRole } from "../../../../features/auth/auth-role";

/**
 * Route-level loading UI for the customer detail page, shown while the server
 * route runs its access check. The tab labels render as real static text (they
 * aren't server data); only the header and content shimmer. Once the client
 * loader mounts it fills the header instantly from the list-seeded cache.
 */
export default async function Loading() {
  const auth = await getSessionRole();
  const role = (auth?.role ?? "MANAGER") as DashboardRole;

  return (
    <DashboardShell role={role} active="customers">
      <CustomerDetailBodySkeleton />
    </DashboardShell>
  );
}
