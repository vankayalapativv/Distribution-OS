import { DashboardShell } from "@/features/shell/dashboard-shell";
import type { DashboardRole } from "@/features/shell/dashboard-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionRole } from "../../../../features/auth/auth-role";

/** Mirrors one section card in the Details tab (title + 2-col field grid). */
function InfoCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white px-5 py-3 shadow-sm">
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_LABELS = ["Details", "Orders", "Ledger", "Photos"];

/**
 * Route-level loading UI for the customer detail page. Shown the instant a
 * customer row is clicked, until the server fetch (getCustomer) resolves.
 * Renders inside the dashboard shell (the app has no dashboard layout, so the
 * shell must be here too) and mirrors the real layout: header → tab bar →
 * Details info cards. The Orders/Ledger/Photos tabs keep their own client-side
 * skeletons once you switch to them.
 */
export default async function Loading() {
  const auth = await getSessionRole();
  const role = (auth?.role ?? "MANAGER") as DashboardRole;

  return (
    <DashboardShell role={role} active="customers">
      {/* Header: breadcrumb, title, status + code, actions */}
      <div>
        <Skeleton className="h-3 w-52" />
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TAB_LABELS.map((t) => (
          <div key={t} className="px-4 pb-3.5 pt-3">
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Details content — 5 stacked info cards in a 2-column grid */}
      <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-2 md:items-start">
        {Array.from({ length: 5 }).map((_, i) => (
          <InfoCardSkeleton key={i} />
        ))}
      </div>
    </DashboardShell>
  );
}
